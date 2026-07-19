"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoModule = exports.MongoLifecycle = exports.MONGO_DATABASE = exports.MONGO_CLIENT = void 0;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
const bootstrap_service_1 = require("./bootstrap.service");
const mongo_tokens_1 = require("./mongo.tokens");
var mongo_tokens_2 = require("./mongo.tokens");
Object.defineProperty(exports, "MONGO_CLIENT", { enumerable: true, get: function () { return mongo_tokens_2.MONGO_CLIENT; } });
Object.defineProperty(exports, "MONGO_DATABASE", { enumerable: true, get: function () { return mongo_tokens_2.MONGO_DATABASE; } });
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required to connect to MongoDB`);
    }
    return value;
}
let MongoLifecycle = class MongoLifecycle {
    client;
    constructor(client) {
        this.client = client;
    }
    async onApplicationShutdown() {
        await this.client.close();
    }
};
exports.MongoLifecycle = MongoLifecycle;
exports.MongoLifecycle = MongoLifecycle = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mongo_tokens_1.MONGO_CLIENT)),
    __metadata("design:paramtypes", [mongodb_1.MongoClient])
], MongoLifecycle);
let MongoModule = class MongoModule {
};
exports.MongoModule = MongoModule;
exports.MongoModule = MongoModule = __decorate([
    (0, common_1.Module)({
        providers: [
            {
                provide: mongo_tokens_1.MONGO_CLIENT,
                useFactory: async () => {
                    const uri = requiredEnv('MONGODB_URI');
                    requiredEnv('MONGODB_DATABASE');
                    const client = new mongodb_1.MongoClient(uri, {
                        serverSelectionTimeoutMS: 5_000,
                    });
                    await client.connect();
                    return client;
                },
            },
            {
                provide: mongo_tokens_1.MONGO_DATABASE,
                inject: [mongo_tokens_1.MONGO_CLIENT],
                useFactory: (client) => client.db(requiredEnv('MONGODB_DATABASE')),
            },
            MongoLifecycle,
            bootstrap_service_1.MongoBootstrapService,
        ],
        exports: [mongo_tokens_1.MONGO_CLIENT, mongo_tokens_1.MONGO_DATABASE],
    })
], MongoModule);
//# sourceMappingURL=mongo.provider.js.map