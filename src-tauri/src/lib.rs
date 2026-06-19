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
    // tauri-plugin-sql 使用 BaseDirectory::App，但具体路径取决于平台和版本
    // 尝试多个可能的路径，选择第一个存在的文件（非空）
    let candidates = [
        ("app_data_dir", app.path().app_data_dir().ok().map(|p| p.join("doit.db"))),
        ("app_config_dir", app.path().app_config_dir().ok().map(|p| p.join("doit.db"))),
        ("app_local_data_dir", app.path().app_local_data_dir().ok().map(|p| p.join("doit.db"))),
    ];

    let last_error = "未找到数据库文件".to_string();

    for (_label, path_opt) in &candidates {
        if let Some(ref path) = path_opt {
            if path.exists() {
                let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                if size > 0 {
                    return Ok(path.clone());
                }
            }
        }
    }

    // 返回 app_local_data_dir 的路径（即使文件不存在，让调用方处理）
    if let Some(ref path) = candidates[2].1 {
        return Ok(path.clone());
    }

    Err(last_error)
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

    // 在读 db 文件前先做 WAL checkpoint，把 wal 文件中的最新数据合并到主 db 文件
    // 注意：必须在 closeDb 之后调用，否则会因为 SQLITE_BUSY 失败
    {
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("打开数据库失败: {}", e))?;
        // 设置较短的 busy timeout，让它快速失败
        conn.busy_timeout(std::time::Duration::from_millis(500)).ok();
        let _ = conn.execute("PRAGMA wal_checkpoint(PASSIVE)", []);

        // 清理非 todos/settings 的表（_sqlx_migrations 等系统表）
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
        // 再次 checkpoint 确保 DROP 写入主文件
        let _ = conn.execute("PRAGMA wal_checkpoint(PASSIVE)", []);
    }

    let data = std::fs::read(&db).map_err(|e| format!("读取数据库文件失败: {}", e))?;
    let data_len = data.len();
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

    // 备份当前数据库文件
    if db.exists() {
        let backup_name = format!("{}.bak", db.display());
        let _ = std::fs::copy(&db, &backup_name);
    }

    std::fs::write(&db, &bytes).map_err(|e| format!("写入数据库文件失败: {}", e))?;

    Ok("下载成功，数据库已恢复".to_string())
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
    if !db.exists() {
        return Err(format!("数据库文件不存在: {}", db.display()));
    }
    let conn = rusqlite::Connection::open(&db)
        .map_err(|e| format!("打开数据库失败: {}", e))?;

    let mut tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(|e| format!("查询表失败: {}", e))?
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("读取表列表失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut dropped: Vec<String> = Vec::new();
    for name in &tables {
        if name != "todos" && name != "settings" {
            let sql = format!("DROP TABLE IF EXISTS \"{}\"", name);
            if conn.execute(&sql, []).is_ok() {
                dropped.push(name.clone());
            }
        }
    }

    conn.execute("VACUUM", []).ok();
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []).ok();
    drop(conn);

    let bytes = std::fs::read(&db).map_err(|e| format!("读取清理后的数据库失败: {}", e))?;
    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("写入目标文件失败: {}", e))?;

    tables.retain(|n| n == "todos" || n == "settings");
    Ok(format!(
        "已导出干净的数据库 ({} bytes)，仅包含 {} (共 {} 个内部表已移除)",
        bytes.len(),
        tables.join(", "),
        dropped.len()
    ))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            tauri_fetch,
            upload_db_to_webdav,
            download_db_from_webdav,
            clean_export_db
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
