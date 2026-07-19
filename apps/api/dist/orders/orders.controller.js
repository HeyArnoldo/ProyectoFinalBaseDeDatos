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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@app/contracts");
const seed_service_1 = require("../database/seed.service");
const operator_guard_1 = require("../auth/operator.guard");
const checkout_service_1 = require("./checkout.service");
const transition_service_1 = require("./transition.service");
let OrdersController = class OrdersController {
    checkoutService;
    transitionService;
    constructor(checkoutService, transitionService) {
        this.checkoutService = checkoutService;
        this.transitionService = transitionService;
    }
    async checkout(body, restaurantId) {
        const parsed = contracts_1.checkoutRequestSchema.safeParse(body);
        if (!parsed.success)
            throw new common_1.BadRequestException('Invalid checkout request');
        return this.checkoutService.checkout(parsed.data, restaurantId ?? seed_service_1.DEFAULT_RESTAURANT_ID);
    }
    async transition(orderId, body) {
        const parsedId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(orderId);
        const parsed = contracts_1.orderTransitionRequestSchema.safeParse(body);
        if (!parsedId || !parsed.success)
            throw new common_1.BadRequestException('Invalid order transition request');
        if (!this.transitionService)
            throw new Error('Transition service is not configured');
        return this.transitionService.transition(orderId, parsed.data.status);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)('checkout'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('restaurantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "checkout", null);
__decorate([
    (0, common_1.Patch)(':orderId/status'),
    (0, common_1.UseGuards)(operator_guard_1.OperatorGuard),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "transition", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [checkout_service_1.CheckoutService,
        transition_service_1.TransitionService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map