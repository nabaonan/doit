use tauri_plugin_sql::{Migration, MigrationKind};
use base64::Engine;
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
    app.path()
        .app_config_dir()
        .map_err(|e| format!("获取配置目录失败: {}", e))
        .map(|p| p.join("doit.db"))
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
    let data = std::fs::read(&db).map_err(|e| format!("读取数据库文件失败: {}", e))?;

    let client = make_client()?;
    let auth_header = build_auth_header(&username, &password);

    // 上传带时间戳的文件
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
        let resp = client
            .put(&full_url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/octet-stream")
            .body(data.clone())
            .send()
            .await
            .map_err(|e| format!("上传 {} 失败: {}", name, e))?;

        let status = resp.status().as_u16();
        if status < 200 || status >= 300 {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("上传 {} 失败: HTTP {} - {}", name, status, text));
        }

        uploaded.push(name.clone());
    }

    Ok(format!("上传成功: {}", uploaded.join(", ")))
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

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: "CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL DEFAULT '',
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            tag_id TEXT,
            cat_id TEXT,
            parent_id TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:doit.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            tauri_fetch,
            upload_db_to_webdav,
            download_db_from_webdav
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
