const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const client = redis.createClient();
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this;
}

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    console.log("FROM DATABASE")
    return exec.apply(this,arguments);
  }
  const queryOptions = Object.assign({}, this.getQuery(), {
		collection: this.mongooseCollection.name,
	});
	const key = JSON.stringify(queryOptions);
  const cacheData = await client.hget(this.hashKey,key);
  if (!cacheData) {
    console.log('NO CACHE DATA YET');
    const modelInstance = await exec.apply(this, arguments);
    client.hmset(this.hashKey, key, JSON.stringify(modelInstance), 'EX', 10);
    return modelInstance;
  }
  const doc = JSON.parse(cacheData);
  console.log('FROM CACHE')
  return Array.isArray(doc)
    ? doc.map((d)=> new this.model(d))
    : new this.model(doc);
}

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
}