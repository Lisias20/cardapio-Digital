const path = require('path');

const dataDir = path.resolve(__dirname, 'data');

function cfg() {
  return {
    client: 'sqlite3',
    connection: {
      filename: path.join(dataDir, 'db.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src', 'migrations')
    },
    seeds: {
      directory: path.resolve(__dirname, 'src', 'seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  };
}

module.exports = {
  development: cfg(),
  production: cfg()
};