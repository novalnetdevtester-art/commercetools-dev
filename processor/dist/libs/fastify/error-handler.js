"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../logger");
const connect_payments_sdk_1 = require("@commercetools/connect-payments-sdk");
function isFastifyValidationError(error) {
    return error.validation != undefined;
}
const errorHandler = (error, req, reply) => {
    if (isFastifyValidationError(error) && error.validation) {
        return handleErrors(transformValidationErrors(error.validation, req), reply);
    }
    else if (error instanceof connect_payments_sdk_1.ErrorAuthErrorResponse) {
        return handleAuthError(error, reply);
    }
    else if (error instanceof connect_payments_sdk_1.Errorx) {
        return handleErrors([error], reply);
    }
    else if (error instanceof connect_payments_sdk_1.MultiErrorx) {
        return handleErrors(error.errors, reply);
    }
    // If it isn't any of the cases above (for example a normal Error is thrown) then fallback to a general 500 internal server error
    return handleErrors([
        new connect_payments_sdk_1.ErrorGeneral("Internal server error.", {
            cause: error,
            skipLog: false,
        }),
    ], reply);
};
exports.errorHandler = errorHandler;
const handleAuthError = (error, reply) => {
    const transformedErrors = transformErrorxToHTTPModel([error]);
    const response = {
        message: error.message,
        statusCode: error.httpErrorStatus,
        errors: transformedErrors,
        error: transformedErrors[0].code,
        error_description: transformedErrors[0].message,
    };
    return reply.code(error.httpErrorStatus).send(response);
};
const handleErrors = (errorxList, reply) => {
    const transformedErrors = transformErrorxToHTTPModel(errorxList);
    // Based on CoCo specs, the root level message attribute is always set to the values from the first error. MultiErrorx enforces the same HTTP status code.
    const response = {
        message: errorxList[0].message,
        statusCode: errorxList[0].httpErrorStatus,
        errors: transformedErrors,
    };
    return reply.code(errorxList[0].httpErrorStatus).send(response);
};
const transformErrorxToHTTPModel = (errors) => {
    const errorObjectList = [];
    for (const err of errors) {
        if (err.skipLog) {
            logger_1.log.debug(err.message, err);
        }
        else {
            logger_1.log.error(err.message, err);
        }
        const tErrObj = {
            code: err.code,
            message: err.message,
            ...(err.fields ? err.fields : {}), // Add any additional field to the response object (which will differ per type of error)
        };
        errorObjectList.push(tErrObj);
    }
    return errorObjectList;
};
const transformValidationErrors = (errors, req) => {
    const errorxList = [];
    for (const err of errors) {
        switch (err.keyword) {
            case "required":
                errorxList.push(new connect_payments_sdk_1.ErrorRequiredField(err.params.missingProperty));
                break;
            case "enum":
                errorxList.push(new connect_payments_sdk_1.ErrorInvalidField(getKeys(err.instancePath).join("."), getPropertyFromPath(err.instancePath, req.body), err.params.allowedValues));
                break;
        }
    }
    // If we cannot map the validation error to a CoCo error then return a general InvalidJsonError
    if (errorxList.length === 0) {
        errorxList.push(new connect_payments_sdk_1.ErrorInvalidJsonInput());
    }
    return errorxList;
};
const getKeys = (path) => path.replace(/^\//, "").split("/");
const getPropertyFromPath = (path, obj) => {
    const keys = getKeys(path);
    let value = obj;
    for (const key of keys) {
        value = value[key];
    }
    return value;
};
