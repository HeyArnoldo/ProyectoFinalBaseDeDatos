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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorGuard = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
function cookieFromHeader(header, name) {
    return header?.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
}
let OperatorGuard = class OperatorGuard {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = cookieFromHeader(request.headers.cookie, auth_service_1.OPERATOR_SESSION_COOKIE);
        const operator = token ? this.auth.verify(token) : null;
        if (!operator)
            throw new common_1.UnauthorizedException();
        request.operator = operator;
        return true;
    }
};
exports.OperatorGuard = OperatorGuard;
exports.OperatorGuard = OperatorGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], OperatorGuard);
//# sourceMappingURL=operator.guard.js.map