const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const client = redis.createClient();
client.get = util.promisify(client.get);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function() {
  this.useCache = true;
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
  const cacheData = await client.get(key);
  if (!cacheData) {
    console.log('NO CACHE DATA YET');
    const modelInstance = await exec.apply(this, arguments);
    client.set(key, JSON.stringify(modelInstance), 'EX', 10);
    return modelInstance;
  }
  const doc = JSON.parse(cacheData);
  console.log('FROM CACHE')
  return Array.isArray(doc)
    ? doc.map((d)=> new this.model(d))
    : new this.model(doc);
  
}