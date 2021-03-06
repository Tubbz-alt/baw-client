/**
 * This service is designed to work with a set of objects returned from
 * a chatty API. Its purpose is to link resources to their parent objects
 * which are stored in separate collections. It does this by using a
 * graph of associations to dynamically make a function that will traverse
 * that graph to look for matches and attach them to the host object.
 */
angular
    .module("bawApp.models.associations", [])
    .factory(
        "baw.models.Capabilities",
        [
            function () {
                let missingCapability = Object.freeze({
                    can: null,
                    details: "No reason is available",
                    message: null
                });



                const messages = {
                    ifAuthorized(message){
                        return message !== messages.unauthorized;
                    },
                    forbidden: "forbidden",
                    unauthorized: "unauthorized",
                    conflict: "conflict"
                };

                class Capabilities {
                    constructor(capabilityObject) {
                        this.actions = capabilityObject || {};

                    }

                    can(source, actionName, reason) {
                        let result;
                        // if reason is defined then we want to return a result based on that reason only
                        if (!reason) {
                            result = this.get(source, actionName, "can");
                        } else {
                            if (angular.isFunction(reason)) {
                                result = reason(this.message(source, actionName));
                            }
                            else {
                                result = reason === this.message(source, actionName);
                            }
                        }

                        return result;
                    }

                    details(source, actionName) {
                        return this.get(source, actionName, "details");
                    }

                    message(source, actionName) {
                        return this.get(source, actionName, "message");
                    }

                    get(source, actionName, selector) {
                        let action = this.actions[actionName];
                        if (action) {
                            if (selector) {
                                let value = action[selector];
                                if (angular.isFunction(value)) {
                                    return value.call(action, action, source);
                                }
                                else {
                                    return value;
                                }
                            }
                            return action;
                        }
                        else {
                            return missingCapability;
                        }
                    }

                    static get missing() {
                        return missingCapability;
                    }

                    static get reasons() {
                        return messages;
                    }
                }

                return Capabilities;
            }
        ]
    ).factory(
        "baw.models.ApiBase",
        [
            "baw.models.Capabilities",
            function (Capabilities) {
                let metaKey = Symbol("meta");

                class ApiBase {

                    constructor(resource) {
                        Object.assign(this, resource);

                        // createdAt and UpdatedAt are fairly common attributes
                        if (this.createdAt) {
                            this.createdAt = new Date(this.createdAt);
                        }

                        if (this.updatedAt) {
                            this.updatedAt = new Date(this.updatedAt);
                        }

                        if (this.creatorId) {
                            this.creatorId = Number(this.creatorId);
                        }

                        if (this.updaterId) {
                            this.updaterId = Number(this.updaterId);
                        }
                    }

                    /**
                     * If called, auto downloads linked resources.
                     * Since we want customizable behaviour, we force an explicit call
                     * to autoDownload.
                     * @param resources
                     */
                    autoDownload(resources) {

                    }

                    get hasId() {
                        return !(this.id === undefined || this.id === null);
                    }

                    /**
                     * Holds the meta object from an API response.
                     * @returns {*}
                     */
                    get meta() {
                        return this[metaKey];
                    }

                    /**
                     * Capability tester. Can an action be implemented?
                     */
                    can(actionName, reason) {
                        return this[metaKey].capabilities.can(this, actionName, reason);
                    }

                    // security related helpers
                    // note: ideally these should not be needed once capabilities are developed for the REST API
                    isOwnedBy(user) {
                        if (!user) {
                            return null;
                        }

                        if (user.isAdmin) {
                            return true;
                        }

                        if (this.creatorId) {
                            return this.creatorId === user.id || this.updaterId === user.id;
                        }

                        return null;
                    }



                    static make(resource) {
                        //noinspection JSValidateTypes
                        if (this === window) {
                            throw new Error("This static method must be called with a bound this");
                        }

                        return new this(resource);
                    }

                    /**
                     * This function generates a converter for models to use.constructor
                     * This provided models with a function to convert API responses
                     * into DS objects.
                     *
                     * TODO: remove the need to return the FULL APi object
                     * @returns {}
                     * @param response
                     */
                    static makeFromApi(response) {
                        //noinspection JSValidateTypes
                        if (this === window) {
                            throw new Error("This static method must be called with a bound this");
                        }

                        // dirty hack: the multi-pager loader sends through an array of responses
                        // TODO: remove this and fix the pager!
                        let canonicalResponse = response.responses && response.responses[0] || response;

                        if ((canonicalResponse.headers("content-type") || "").indexOf("application/json") < 0) {
                            throw new Error(`The request ${canonicalResponse.config.method} ${canonicalResponse.config.url} does not contain a JSON response`);
                        }

                        var items = [];
                        if (angular.isArray(response.data.data)) {
                            //noinspection JSUnresolvedVariable
                            items = response.data.data.map(this.make, this);
                        } else {
                            //noinspection JSUnresolvedFunction
                            items[0] = this.make(response.data.data);
                        }

                        // allow all object to get and set their meta data object
                        let meta = canonicalResponse.data.meta;

                        // setup capabilities

                        // HACK: while capabilities not supported by API we instead draw them from the client Models
                        if (meta.capabilities === undefined) {
                            if (this.capabilities) {
                                console.warn(`Capabilities for ${this.name} are drawn from client model`);
                                meta.capabilities = this.capabilities;
                            }
                            else {
                                meta.capabilities = {};
                            }
                        }
                        meta.capabilities = new Capabilities(meta.capabilities);

                        meta.source = new URL(canonicalResponse.config.url);

                        // give each object a reference to meta
                        items.forEach((a) => a[metaKey] = meta);

                        response.data.data = items;

                        return response;
                    }

                    static makeFromApiWithType(Type) {
                        return function (resource) {
                            return ApiBase.makeFromApi.call(Type, resource);
                        };
                    }


                }

                return ApiBase;
            }
        ])
    .factory(
        "baw.models.ModelUnavailable",
        [
            "baw.models.ApiBase",
            function (ApiBase) {
                class ModelUnavailable extends ApiBase {

                    constructor(error) {
                        super();

                        this.error = error;
                    }
                }

                return ModelUnavailable;
            }
        ])
    .filter("modelAvailable",
        [
            "baw.models.ModelUnavailable",
            function (ModelUnavailable) {
                return function(models) {
                    return models.filter(x => !(x instanceof ModelUnavailable));
                };
            }
        ])
    .factory(
        "baw.models.associations",
        [
            "casingTransformers",
            "baw.models.ApiBase",
            "baw.models.ModelUnavailable",
            function (casingTransformers, ApiBase, ModelUnavailable) {
                const parentRelationSuffix = "Id",
                    pluralitySuffix = "s",
                    parentManyRelationSuffix = "Id" + pluralitySuffix,
                    id = "id",
                    arityMany = Symbol("many"),
                    arityOne = Symbol("one"),
                    unavailable = "This parent resource is unavailable.",
                    undefinedToUnavailable = x => x === undefined ? new ModelUnavailable(unavailable) : x,
                    linkerCache = new Map();

                var getName = (n) => n instanceof Object ? n.name : n;
                var getArity = (n) => n instanceof Object ? n.arity : arityOne;

                function many(name) {
                    return {name, arity: arityMany};
                }

                function one(name) {
                    return {name, arity: arityOne};
                }


                var associations = Object.freeze(new Map([
                    [
                        "Tag", {
                        parents: null, children: [many("Tagging")]
                    }],
                    [
                        "Tagging", {
                        parents: ["Tag", "AudioEvent"], children: null
                    }],
                    [
                        "AudioEvent", {
                        parents: ["AudioRecording"], children: [many("Tagging")]
                    }],
                    [
                        "AudioRecording", {
                        // we don't have a nice way to fit the media association in,
                        // we don't need it at the moment
                        parents: ["Site"], children: [many("AudioEvent"), many("Bookmark") /*, "Media" */]
                    }],
                    [
                        "Site", {
                        parents: [many("Project")], children: [many("AudioRecording")]
                    }],
                    [
                        "Project", {
                        parents: null, children: [many("Site")]
                    }],
                    [
                        "Media", {
                        parents: ["AudioRecording"], children: null
                    }],
                    [
                        "Bookmark", {
                        parents: ["AudioRecording", "User"], children: null
                    }],
                    [
                        "User", {
                        parents: null, children: [many("Bookmark")]
                    }],
                    [
                        "SavedSearch", {
                        parents: [many("AnalysisJob")], children: null
                    }],
                    [
                        "Script", {
                        parents: [many("AnalysisJob")], children: null
                    }],
                    [
                        "AnalysisJob", {
                        parents: null, children: [one("Script"), one("SavedSearch")]
                    }]
                ]));


                function chainToString(chain) {
                    return chain.reduce((s, c) => s + "->" + c, "");
                }

                return {
                    generateLinker,
                    arrayToMap,
                    associations,
                    autoDownload
                };


                function autoDownload(targetType, arity = arityOne, limit = []) {
                    throw new Error("Not Implemented");
                    /*
                    // get associated models
                    let targetAssociation = associations.get(targetType),
                        models = [];
                    if (targetAssociation.parents) {
                        models = models.concat(targetAssociation.parents);
                    }
                    if (targetAssociation.children) {
                        models = models.concat(targetAssociation.children);
                    }

                    models = models
                        .filter(p => arity === arityMany || getArity(p) === arityOne)
                        .filter(p => limit.length === 0 || limit.indexOf(getName(p)) >= 0);

                    // get linkers
                    let linkers = models.map( model => generateLinker(targetType, model) );

                    // TODO: this won't work until services are expressed as Service functions
                    let getService = () => { };

                    for (let i = 0; i < models.length; i++) {


                        let model = models[i],
                            arity = getArity(model),
                            service = getService(getName(model));

                        if (arity === arityMany) {
                            service.filter()
                        }
                        else {
                            service.get()
                        }
                    }
                    */
                }



                function isManyAssociation(previousAssociation, currentAssociation) {
                    let p = previousAssociation.parents || [],
                        c = previousAssociation.children || [];

                    let a = p.concat(c).find(x => getName(x) === currentAssociation);
                    if (!a) {
                        return false;
                    }

                    return getArity(a) === arityMany;
                }

                /**
                 * This function determines if there is a way to link
                 * a child to a parent node. If there is, it returns a function
                 * that will do the linking.
                 */
                function generateLinker(child, parent) {

                    let cacheKey = child + "---->" + parent;
                    if (linkerCache.has(cacheKey)) {
                       return linkerCache.get(cacheKey);
                    }

                    if (!associations.has(child)) {
                        throw new Error("Child must be one of the known associations");
                    }

                    if (!associations.has(parent)) {
                        throw new Error("Parent must be one of the known associations");
                    }

                    // traverse the nodes
                    var chains = [[child]];
                    searchGraph(child, parent, chains);

                    // select the shortest path
                    var {index} = chains.reduce(({length, index}, current, currentIndex) => {
                        if (current && current.length < length) {
                            length = current.length;
                            index = currentIndex;
                        }
                        return {length, index};
                    }, {length: +Infinity, index: -1});

                    var chain = chains[index],
                        correctCase = chain.map(key => key[0].toLowerCase() + key.slice(1));

                    console.debug("associations:generateLinker:", chainToString(chain));

                    // now make an optimised function to execute it
                    let linker = function (target, associationCollections) {
                        var currentTargets = [target];
                        for (let c = 1; c < chain.length; c++) {
                            let association = chain[c],
                            // check if the current target could have many parents or children
                                manyTargets = isManyAssociation(associations.get(chain[c - 1]), association),
                                targetIdName = correctCase[c] + (manyTargets ? parentManyRelationSuffix : parentRelationSuffix),
                                targetName = correctCase[c] + (manyTargets ? pluralitySuffix : "");

                            // get the collection appropriate for the first association
                            if (!associationCollections.hasOwnProperty(association)) {
                                throw new Error(`No associations Map supplied for model ${association}`);
                            }
                            let possibleParentObjects = associationCollections[association];

                            // when following many arity associations, there may be more than one
                            // target that needs to be worked on
                            let realAssociations = [];
                            for (let d = 0; d < currentTargets.length; d++) {
                                let currentTarget = currentTargets[d];

                                if (currentTarget instanceof ModelUnavailable) {
                                    // we can't follow the chain of a missing association
                                    continue;
                                }

                                console.assert(currentTarget, "currentTarget should not be null!");

                                // deal with the case of targets already having associations set
                                if (currentTarget[targetName] instanceof Object) {
                                    realAssociations = currentTarget[targetName];
                                    console.assert(manyTargets ? realAssociations instanceof Array : true, "Discovered associations should be an array");
                                }
                                else {
                                    // get the parent id from the child
                                    let associationIds = [];
                                    if (manyTargets) {
                                        associationIds = currentTarget[targetIdName];
                                    }
                                    else {
                                        associationIds[0] = currentTarget[targetIdName];
                                    }

                                    // ensure we were able to get Ids
                                    let idsValid = associationIds.every(x => x !== undefined);
                                    if (!idsValid) {
                                        throw new Error("Unable to link to associations because their ids are invalid or missing");
                                    }

                                    // get correct parent object
                                    // assume es6 map
                                    realAssociations = associationIds.map(Map.prototype.get, possibleParentObjects);

                                    // handle the cases of missing associations
                                    // this can sometimes happen when certain associations are
                                    // filtered out from a dataset for security reasons
                                    realAssociations = realAssociations.map(undefinedToUnavailable);

                                    // assign to child
                                    currentTarget[targetName] = manyTargets ? realAssociations : realAssociations[0];
                                }
                            }

                            // nest into parent(s)
                            currentTargets = realAssociations;
                        }

                        // return our amped up child
                        return target;
                    };

                    linkerCache.set(cacheKey, linker);
                    return linker;
                }

                /**
                 * Recursive graph search.
                 *
                 * Can search up and down graphs.
                 * Does not allow revisiting a node.
                 *
                 * @param current
                 * @param rootParent
                 * @param chains
                 * @param {int} currentChain
                 */
                function searchGraph(current, rootParent, chains, currentChain = 0) {
                    if (!chains[currentChain]) {
                        chains[currentChain] = [];
                    }

                    if (current === rootParent) {
                        // end of chain, success
                        return true;
                    }

                    let {parents, children} = associations.get(current);

                    let nodesToVisit = (parents || []).concat(children || []);

                    for (var i = 0; i < nodesToVisit.length; i++) {
                        var n = nodesToVisit[i];
                        let thisNode = getName(n);

                        // prevent cyclic loops
                        // if the new node has already been visited,
                        // do not visit again
                        if (chains[currentChain] && chains[currentChain].includes(thisNode)) {
                            continue;
                        }

                        // each node represents a different path to follow.
                        // follow each and aggregate
                        let chainCopy = Array.from(chains[currentChain]);

                        // add in current node
                        chainCopy.push(thisNode);

                        let chainIndex = chains.push(chainCopy) - 1;

                        // recursive call
                        searchGraph(thisNode, rootParent, chains, chainIndex);
                    }

                    // based on the recursive nature of the above, the current chain
                    // should always be deprecated
                    // either it is valid/invalid (and the function has exited already)
                    // or recursion that followed a different path has rendered this path obsolete
                    chains[currentChain] = undefined;
                }

                /**
                 * Converts a collection of restful objects,
                 * where they follow the convention of always having a unique and identifying
                 * `id` field into an es6 Map.
                 */
                function arrayToMap(items) {
                    return new Map(
                        items.map(item => [item[id], item])
                    );
                }

            }
        ]
    );
