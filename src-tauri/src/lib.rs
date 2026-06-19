use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct FetchRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct FetchResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // 打印所有候选路径，用于诊断
    eprintln!("[db_path] === 诊断所有路径 ===");
    eprintln!("[db_path] app_data_dir: {:?}", app.path().app_data_dir().ok());
    eprintln!("[db_path] app_config_dir: {:?}", app.path().app_config_dir().ok());
    eprintln!("[db_path] app_local_data_dir: {:?}", app.path().app_local_data_dir().ok());

    // 列出所有候选 db 文件路径
    let candidates = [
        ("app_data_dir", app.path().app_data_dir().ok().map(|p| p.join("doit.db"))),
        ("app_config_dir", app.path().app_config_dir().ok().map(|p| p.join("doit.db"))),
        ("app_local_data_dir", app.path().app_local_data_dir().ok().map(|p| p.join("doit.db"))),
    ];

    for (label, path_opt) in &candidates {
        if let Some(ref path) = path_opt {
            if path.exists() {
                let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                let wal = path.with_extension("db-wal");
                let shm = path.with_extension("db-shm");
                let wal_size = std::fs::metadata(&wal).map(|m| m.len()).unwrap_or(0);
                let shm_size = std::fs::metadata(&shm).map(|m| m.len()).unwrap_or(0);
                eprintln!(
                    "[db_path] {}: db={} (size={}) wal_size={} shm_size={}",
                    label, path.display(), size, wal_size, shm_size
                );
            } else {
                eprintln!("[db_path] {}: {} (NOT EXISTS)", label, path.display());
            }
        }
    }

    for (label, path_opt) in &candidates {
        if let Some(ref path) = path_opt {
            if path.exists() {
                let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                if size > 0 {
                    return Ok(path.clone());
                }
            }
        }
    }

    if let Some(ref path) = candidates[2].1 {
        return Ok(path.clone());
    }

    Err("未找到数据库文件".to_string())
}

/// 独立诊断命令：列出所有可能的 db 路径以及伴随的 wal/shm 文件大小
/// 前端可在弹窗打开时调用，立即在终端打印诊断信息
#[tauri::command]
fn diagnose_db_paths(app: tauri::AppHandle) -> Result<String, String> {
    eprintln!("[diagnose] === 诊断 db 路径 ===");
    eprintln!("[diagnose] app_data_dir: {:?}", app.path().app_data_dir().ok());
    eprintln!("[diagnose] app_config_dir: {:?}", app.path().app_config_dir().ok());
    eprintln!("[diagnose] app_local_data_dir: {:?}", app.path().app_local_data_dir().ok());

    let candidates = [
        ("app_data_dir", app.path().app_data_dir().ok().map(|p| p.join("doit.db"))),
        ("app_config_dir", app.path().app_config_dir().ok().map(|p| p.join("doit.db"))),
        ("app_local_data_dir", app.path().app_local_data_dir().ok().map(|p| p.join("doit.db"))),
    ];

    let mut report = String::new();
    for (label, path_opt) in &candidates {
        if let Some(ref path) = path_opt {
            let exists = path.exists();
            let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            let wal = path.with_extension("db-wal");
            let shm = path.with_extension("db-shm");
            let wal_size = std::fs::metadata(&wal).map(|m| m.len()).unwrap_or(0);
            let shm_size = std::fs::metadata(&shm).map(|m| m.len()).unwrap_or(0);
            // 文件最后修改时间
            let mtime = std::fs::metadata(path)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            // 用只读方式打开，列出表名和行数
            let mut table_info = String::new();
            if exists && size > 0 {
                if let Ok(conn) = rusqlite::Connection::open_with_flags(
                    path,
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
                ) {
                    if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") {
                        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                            for r in rows.flatten() {
                                let cnt: i64 = conn
                                    .query_row(&format!("SELECT count(*) FROM \"{}\"", r), [], |row| row.get(0))
                                    .unwrap_or(-1);
                                table_info.push_str(&format!("{}={} ", r, cnt));
                            }
                        }
                    }
                }
            }
            let line = format!(
                "{}: path={} exists={} db_size={} mtime={} wal_size={} shm_size={} tables=[{}]",
                label, path.display(), exists, size, mtime, wal_size, shm_size, table_info
            );
            eprintln!("[diagnose] {}", line);
            report.push_str(&line);
            report.push('\n');
        }
    }

    Ok(report)
}

fn make_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

fn build_auth_header(username: &str, password: &str) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", username, password));
    format!("Basic {}", encoded)
}

#[tauri::command]
async fn tauri_fetch(req: FetchRequest) -> Result<FetchResponse, String> {
    let client = make_client()?;

    let method = req.method.to_uppercase();
    let req_builder = match method.as_str() {
        "GET" => client.get(&req.url),
        "POST" => client.post(&req.url),
        "PUT" => client.put(&req.url),
        "DELETE" => client.delete(&req.url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &req.url),
        "PROPFIND" => client.request(reqwest::Method::from_bytes(b"PROPFIND").map_err(|e| format!("无效方法: {}", e))?, &req.url),
        _ => return Err(format!("不支持的方法: {}", method)),
    };

    let mut header_map = reqwest::header::HeaderMap::new();
    for (k, v) in &req.headers {
        let name = reqwest::header::HeaderName::from_bytes(k.as_bytes())
            .map_err(|e| format!("无效头名称 {}: {}", k, e))?;
        let value = reqwest::header::HeaderValue::from_str(v)
            .map_err(|e| format!("无效头值 {}: {}", v, e))?;
        header_map.insert(name, value);
    }
    let req_builder = req_builder.headers(header_map);

    let req_builder = if let Some(body) = req.body {
        req_builder.body(body)
    } else {
        req_builder
    };

    let resp = req_builder.send().await.map_err(|e| {
        format!("请求失败: {}", e)
    })?;

    let status = resp.status().as_u16();
    let status_text = resp.status().canonical_reason().unwrap_or("Unknown").to_string();
    let resp_headers: HashMap<String, String> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let body = resp.text().await.map_err(|e| format!("读取响应体失败: {}", e))?;

    Ok(FetchResponse {
        status,
        status_text,
        headers: resp_headers,
        body,
    })
}

#[tauri::command]
async fn upload_db_to_webdav(
    app: tauri::AppHandle,
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let db = db_path(&app)?;

    // 把 db 复制到临时文件，对临时文件做清理 + VACUUM + checkpoint，
    // 这样不会和 tauri-plugin-sql 抢锁，且 WAL 数据已合并到主文件
    let (data, data_len) = prepare_clean_db_bytes(&db)?;
    eprintln!("[upload_db] db path: {}, bytes: {}", db.display(), data_len);
    if data_len == 0 {
        return Err(format!("数据库文件为空: {}", db.display()));
    }

    let client = make_client()?;
    let auth_header = build_auth_header(&username, &password);

    let ts_name = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("doit-db-backup_{}.db", ts)
    };
    let latest_name = "doit-db-latest.db".to_string();

    let base = if url.ends_with('/') { url.clone() } else { format!("{}/", url) };

    let mut uploaded = Vec::new();

    for name in &[ts_name, latest_name] {
        let full_url = format!("{}{}", base, name);
        eprintln!("[upload_db] PUT {} ({} bytes)", full_url, data_len);
        let body = Bytes::from(data.clone());
        let resp = client
            .put(&full_url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/octet-stream")
            .header("Content-Length", data_len.to_string())
            .body(body)
            .send()
            .await
            .map_err(|e| format!("上传 {} 失败: {}", name, e))?;

        let status = resp.status().as_u16();
        let req_status_text = resp.status().canonical_reason().unwrap_or("").to_string();
        eprintln!("[upload_db] {} -> HTTP {} {}", name, status, req_status_text);
        if status < 200 || status >= 300 {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("上传 {} 失败: HTTP {} - {}", name, status, text));
        }

        uploaded.push(name.clone());
    }

    Ok(format!("上传成功 ({} bytes): {}", data_len, uploaded.join(", ")))
}

#[tauri::command]
async fn download_db_from_webdav(
    app: tauri::AppHandle,
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let db = db_path(&app)?;
    let client = make_client()?;
    let auth_header = build_auth_header(&username, &password);

    let base = if url.ends_with('/') { url.clone() } else { format!("{}/", url) };
    let latest_url = format!("{}doit-db-latest.db", base);

    let resp = client
        .get(&latest_url)
        .header("Authorization", &auth_header)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

    let status = resp.status().as_u16();
    if status < 200 || status >= 300 {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("下载失败: HTTP {} - {}", status, text));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("读取响应体失败: {}", e))?;

    // 备份当前数据库文件（保留一份以便用户回滚）
    if db.exists() {
        let backup_name = format!("{}.bak", db.display());
        let _ = std::fs::copy(&db, &backup_name);
    }

    // 用临时文件方式替换 db，避免 Windows 上文件锁导致覆盖失败
    // 1. 下载到临时文件
    let temp_path = db.with_extension("db.download.tmp");

    // 2. 写入临时文件
    std::fs::write(&temp_path, &bytes)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 3. 删除原 db + wal + shm（必须先 close pool 否则 Windows 锁住）
    let _ = std::fs::remove_file(&db);
    let _ = std::fs::remove_file(db.with_extension("db-wal"));
    let _ = std::fs::remove_file(db.with_extension("db-shm"));

    // 4. 重命名临时文件为 db
    std::fs::rename(&temp_path, &db)
        .map_err(|e| format!("重命名失败: {}", e))?;

    Ok(format!(
        "下载成功，数据库已恢复 ({} bytes)",
        bytes.len()
    ))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn clean_export_db(
    app: tauri::AppHandle,
    target_path: String,
) -> Result<String, String> {
    let db = db_path(&app)?;
    let (bytes, _len) = prepare_clean_db_bytes(&db)?;
    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("写入目标文件失败: {}", e))?;
    Ok(format!("已导出干净的数据库 ({} bytes)", bytes.len()))
}

/// 把 db 文件复制到临时文件（正确处理 wal 文件），对临时文件做清理 +
/// VACUUM + checkpoint，然后返回临时文件的字节。
/// 这样不与 tauri-plugin-sql 抢锁，且确保 WAL 数据已合并。
fn prepare_clean_db_bytes(db: &PathBuf) -> Result<(Vec<u8>, usize), String> {
    if !db.exists() {
        return Err(format!("数据库文件不存在: {}", db.display()));
    }

    // 临时文件路径：与原 db 在同目录，避免跨盘符复制
    let temp_path = db.with_extension("db.upload.tmp");
    let temp_wal = db.with_extension("db.upload.tmp-wal");
    let temp_shm = db.with_extension("db.upload.tmp-shm");

    let result = (|| -> Result<(Vec<u8>, usize), String> {
        // 删除可能残留的临时文件
        let _ = std::fs::remove_file(&temp_path);
        let _ = std::fs::remove_file(&temp_wal);
        let _ = std::fs::remove_file(&temp_shm);

        // 第零步：先打印源 db 的元信息 + 用源 db 自己的连接查询行数
        // 关键：必须设置 PRAGMA journal_mode = WAL，否则 rusqlite 默认 DELETE 模式
        // 看不到 tauri-plugin-sql 写入 wal 文件的数据
        {
            let src_conn = rusqlite::Connection::open(db)
                .map_err(|e| format!("打开源数据库失败: {}", e))?;
            src_conn.busy_timeout(std::time::Duration::from_secs(2)).ok();
            // 关键：切换到 WAL 模式才能读到 tauri-plugin-sql 的 wal 数据
            let _ = src_conn.execute_batch("PRAGMA journal_mode = WAL;");
            let src_todos: i64 = src_conn
                .query_row("SELECT count(*) FROM todos", [], |row| row.get(0))
                .unwrap_or(-2);
            let src_settings: i64 = src_conn
                .query_row("SELECT count(*) FROM settings", [], |row| row.get(0))
                .unwrap_or(-2);
            eprintln!(
                "[prepare_clean_db] 源 db: {} 直接查询: todos={} settings={} db_size={}",
                db.display(),
                src_todos,
                src_settings,
                std::fs::metadata(db).map(|m| m.len()).unwrap_or(0)
            );
            drop(src_conn);
        }

        // 第一步：用 WAL 模式打开源 db，然后主动做 wal_checkpoint 把 wal 数据合并到主文件
        {
            let conn = rusqlite::Connection::open(db)
                .map_err(|e| format!("打开源数据库失败: {}", e))?;
            conn.busy_timeout(std::time::Duration::from_secs(2)).ok();
            let _ = conn.execute_batch("PRAGMA journal_mode = WAL;");
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            drop(conn);
            eprintln!(
                "[prepare_clean_db] checkpoint 完成, db size: {}",
                std::fs::metadata(db).map(|m| m.len()).unwrap_or(0)
            );
        }

        // 第二步：用 Backup API 把源 db 复制到临时文件
        // 此时源 db 的主文件已包含全部数据（wal 已合并）
        let mut src = rusqlite::Connection::open(db)
            .map_err(|e| format!("打开源数据库(备份模式)失败: {}", e))?;
        src.execute_batch("PRAGMA journal_mode = WAL;")
            .map_err(|e| format!("设置 WAL 模式失败: {}", e))?;
        let mut dst = rusqlite::Connection::open(&temp_path)
            .map_err(|e| format!("创建临时数据库失败: {}", e))?;
        dst.execute_batch("PRAGMA journal_mode = WAL;")
            .map_err(|e| format!("设置临时文件 WAL 模式失败: {}", e))?;

        {
            use rusqlite::backup::Backup;
            let backup = Backup::new(&src, &mut dst)
                .map_err(|e| format!("启动备份失败: {}", e))?;
            loop {
                match backup.step(100) {
                    Ok(rusqlite::backup::StepResult::Done) => break,
                    Ok(_) => continue,
                    Err(e) => return Err(format!("执行备份失败: {}", e)),
                }
            }
        }
        drop(src);
        let _ = dst.close();

        // 验证备份文件是否真的包含数据
        {
            let verify = rusqlite::Connection::open(&temp_path)
                .map_err(|e| format!("验证打开失败: {}", e))?;
            let _ = verify.execute_batch("PRAGMA journal_mode = WAL;");
            let todos_count: i64 = verify
                .query_row("SELECT count(*) FROM todos", [], |row| row.get(0))
                .unwrap_or(-1);
            let settings_count: i64 = verify
                .query_row("SELECT count(*) FROM settings", [], |row| row.get(0))
                .unwrap_or(-1);
            eprintln!(
                "[prepare_clean_db] 备份验证: todos={} settings={}",
                todos_count, settings_count
            );
            if todos_count == 0 && settings_count == 0 {
                return Err("警告：备份文件中没有任何数据，可能是空数据库".to_string());
            }
        }

        // 第三步：清理非 todos/settings 的表
        let conn = rusqlite::Connection::open(&temp_path)
            .map_err(|e| format!("重新打开临时文件失败: {}", e))?;
        let _ = conn.execute_batch("PRAGMA journal_mode = WAL;");

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .map_err(|e| format!("查询表失败: {}", e))?
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("读取表列表失败: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        for name in &tables {
            if name != "todos" && name != "settings" {
                let sql = format!("DROP TABLE IF EXISTS \"{}\"", name);
                let _ = conn.execute(&sql, []);
            }
        }

        // VACUUM + checkpoint
        let _ = conn.execute("VACUUM", []);
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
        drop(conn);

        let bytes = std::fs::read(&temp_path)
            .map_err(|e| format!("读取清理后的数据库失败: {}", e))?;
        let len = bytes.len();
        Ok((bytes, len))
    })();

    // 清理临时文件及其 wal/shm
    let _ = std::fs::remove_file(&temp_path);
    let _ = std::fs::remove_file(&temp_wal);
    let _ = std::fs::remove_file(&temp_shm);

    result
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            tauri_fetch,
            upload_db_to_webdav,
            download_db_from_webdav,
            clean_export_db,
            diagnose_db_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
