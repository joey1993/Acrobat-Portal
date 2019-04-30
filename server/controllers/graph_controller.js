var Entity = require('../models/neo4j/entity')

/*
	response functions
*/
var _manyEntities = function (result) {
  // console.log(result.records);
  // console.log(result.records.map(r => ({ pmID: r.get('a').properties.pmID, entities: r.keys.map(k => r.get(k).properties.id)})));
  // console.log(result.records.map(r => (new Entity(r.get('a')))));          // r._fields[0].properties
  res = result.records.map(r => ({ pmID: r.get('a').properties.pmID, entities: r.keys.map(k => r.get(k).properties.id)}));
  var dict = new Object();
  for (var i = 0; i < res.length; i++) {
    var pmID = res[i].pmID;
    if (!dict.hasOwnProperty(pmID)){
      dict[pmID] = new Object();
      dict[pmID].pmID = pmID;
      dict[pmID].entities = [];
      dict[pmID].entities.push(res[i].entities);
    } else{
        dict[pmID].entities.push(res[i].entities);
    }
  }
  console.log(Object.values(dict));
  return Object.values(dict);
  // return result.records.map(r => ({ pmID: r.get('a').properties.pmID, entities: r.keys.map(k => r.get(k).properties)}));
  	// return result.records.map(r => (new Entity(r.get('a'))))
}

/*
	Private Functions for return id
*/
var _returnBySingleId = function (result) {
  let rec = result.records
  // console.log(rec,'rec')
  if (rec.length === 0) {
    let error = {
      message: 'Entity is not found.',
      status: 404
    }
    throw error
  }
  return new Entity(rec[0].get('c'))
}

/*
	Private Functions for handling Payload
*/
var _handlePayloadValidation = function (err) {
  let code = err.code
  if (code === 'Neo.ClientError.Statement.ParameterMissing') {
    let error = {
      message: err.message,
      status: 409
    }
    throw error
  }
  throw err
}

/*
	Public Functions for Creating nodes
*/
var create = function (session, entity) {
  let query = 'CREATE (c:Entity {id: {id}, entityType: {entityType}, label: {label}, pmID: {pmID}}) RETURN c'
  // console.log(entity);
  var writexResultPromise = session.writeTransaction(function (transaction) {
    // used transaction will be committed automatically, no need for explicit commit/rollback
    var result = transaction.run(query, {
      id: entity.id,
      pmID: entity.pmID,
      entityType: entity.entityType,
      label: entity.label
    })
    return result
  })
  return writexResultPromise.then(_returnBySingleId).catch(_handlePayloadValidation)
}

/*
	Public Functions for Updating nodes
*/
var update = function (session, entity) {
  let query = 'MATCH (c:Entity{id: {id}}) SET c += { entityType: {entityType}, label: {label}, pmID: {pmID}} RETURN c'
  var writexResultPromise = session.writeTransaction(function (transaction) {
    // used transaction will be committed automatically, no need for explicit commit/rollback
    var result = transaction.run(query, {
      id: entity.id,
      pmID: entity.pmID,
      entityType: entity.entityType,
      label: entity.label
    })
    return result
  })

  return writexResultPromise.then(_returnBySingleId).catch(_handlePayloadValidation)
}

/*
	Public Functions for Building relations
*/
var buildRelation = function(session, relation){
	// console.log(relation)
	var relationType = relation.label
	let query = 'MATCH (u:Entity {id: {source}, pmID: {pmID} }), (r:Entity {id: {target}, pmID: {pmID} }) CREATE (u)-[c:'+relationType+']->(r) RETURN c'
	console.log(query)
	var writexResultPromise = session.writeTransaction(function (transaction) {
    // used transaction will be committed automatically, no need for explicit commit/rollback
	   	var result = transaction.run(query, {
	      source: relation.source,
	      target: relation.target,
	      pmID: relation.pmID
	    })
	    return result;
	})

  	return writexResultPromise.then(
  	response => {
  		console.log("in graph controller");
  	}).catch(_handlePayloadValidation)
  // return writexResultPromise.then(() => session.readTransaction(findRelationships).then(() => session.close()));
}

var searchRelation = function(session, relation){
	relationship = relation.label;
  source = relation.source;
  target = relation.target;
  var query = ''
  if(source == ''){
    query = `MATCH (a:Entity)-[:${relationship}]-(b:Entity {label: {target}})
        RETURN a, b`
  }else if(target == ''){
    query = `MATCH (a:Entity {label: {source}})-[:${relationship}]-(b:Entity)
        RETURN a, b`
  }else{
    query = `MATCH (a:Entity {label: {target}})-[:${relationship}]-(b:Entity {label: {target}})
        RETURN a, b`
  }
  console.log(query);
	var readTxResultPromise = session.readTransaction(function (transaction) {
		// used transaction will be committed automatically, no need for explicit commit/rollback
		var result = transaction.run(query, {
		  source: relation.source,
		  target: relation.target
		})
		console.log(result);
		return result
	})

	return readTxResultPromise.then(_manyEntities)
}

/*
	Public Functions for Removing all nodes
*/
var removeAll = function (session) {
  let query = 'MATCH (c) DETACH DELETE c'
  var writexResultPromise = session.writeTransaction(function (transaction) {
    // used transaction will be committed automatically, no need for explicit commit/rollback
    return transaction.run(query)
  })
  return writexResultPromise.then(results => {
    return {
      message: 'All nodes are deleted.'
    }
  })
}

// Exports functions.
module.exports = {
  create: create,
  update: update,
  buildRelation: buildRelation,
  removeAll: removeAll,
  searchRelation: searchRelation
}
