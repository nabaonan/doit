declare module "sql.js/dist/sql-wasm-browser.js" {
  interface SqlJsConfig {
    locateFile?: (file: string) => string
  }
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => any
  }
  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
  namespace initSqlJs {
    let Module: typeof initSqlJs
  }
  export = initSqlJs
}
