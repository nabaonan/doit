use tauri_plugin_sql::{Migration, MigrationKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

#[tauri::command]
async fn tauri_fetch(req: FetchRequest) -> Result<FetchResponse, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

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
async fn read_db_base64(app: tauri::AppHandle) -> Result<String, String> {
    let db_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("获取配置目录失败: {}", e))?
        .join("doit.db");

    let data = std::fs::read(&db_path)
        .map_err(|e| format!("读取数据库文件失败: {}", e))?;

    Ok(base64_encode(&data))
}

#[tauri::command]
async fn write_db_base64(app: tauri::AppHandle, data_base64: String) -> Result<(), String> {
    let db_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("获取配置目录失败: {}", e))?
        .join("doit.db");

    let data = base64_decode(&data_base64)?;

    // 直接覆盖写入数据库文件
    // 注意：SQLite 连接在写入后可能缓存旧数据，
    // 前端需要在 invoke 后重新初始化数据库（closeDb + getDb）
    std::fs::write(&db_path, &data)
        .map_err(|e| format!("写入数据库文件失败: {}", e))?;

    Ok(())
}

fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

fn base64_decode(data: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Base64 解码失败: {}", e))
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
        .invoke_handler(tauri::generate_handler![greet, tauri_fetch, read_db_base64, write_db_base64])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
