const knexLib = require('knex');
const knexfile = require('../../knexfile');
const { env } = require('./config');

const knex = knexLib(knexfile[env] || knexfile.development);

function now() {
  return new Date().toISOString();
}

async function withTx(work) {
  const trx = await knex.transaction();
  try {
    const result = await work(trx);
    await trx.commit();
    return result;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

module.exports = { knex, now, withTx };