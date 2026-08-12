"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomObjectService = void 0;
// src/services/ct-custom-object.service.ts
const custom_fields_1 = require("../utils/custom-fields");
class CustomObjectService {
    DEFAULT_CONTAINER = "nn-private-data";
    // find by container+key using where query (stable)
    async findByContainerAndKey(container, key) {
        const res = await custom_fields_1.apiRoot
            .customObjects()
            .get({
            queryArgs: {
                where: `container="${container}" and key="${key}"`,
                limit: 1,
            },
        })
            .execute()
            .catch(() => null);
        const body = res?.body ?? res;
        if (!body)
            return null;
        const results = body.results ?? [];
        return results.length ? results[0] : null;
    }
    // create (POST /custom-objects)
    async create(container, key, value) {
        return custom_fields_1.apiRoot
            .customObjects()
            .post({
            body: { container, key, value },
        })
            .execute();
    }
    // upsert: POST /custom-objects (create or replace)
    async upsert(container, key, value) {
        return custom_fields_1.apiRoot
            .customObjects()
            .post({
            body: { container, key, value },
        })
            .execute();
    }
    // get resource (or null)
    async get(container, key) {
        return this.findByContainerAndKey(container, key);
    }
}
exports.CustomObjectService = CustomObjectService;
exports.default = new CustomObjectService();
