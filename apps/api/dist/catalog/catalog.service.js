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
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@app/contracts");
const mongodb_1 = require("mongodb");
const mongo_provider_1 = require("../database/mongo.provider");
let CatalogService = class CatalogService {
    db;
    constructor(db) {
        this.db = db;
    }
    async findActive(restaurantId) {
        const items = await this.db
            .collection('catalog_items')
            .find({ restaurantId, active: true })
            .sort({ sku: 1 })
            .toArray();
        return contracts_1.catalogItemSchema.array().parse(items);
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mongo_provider_1.MONGO_DATABASE)),
    __metadata("design:paramtypes", [mongodb_1.Db])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map