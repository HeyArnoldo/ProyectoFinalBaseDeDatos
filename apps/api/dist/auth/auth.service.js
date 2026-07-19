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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.OPERATOR_SESSION_TTL_SECONDS = exports.OPERATOR_SESSION_COOKIE = void 0;
exports.loadAuthConfig = loadAuthConfig;
const common_1 = require("@nestjs/common");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.OPERATOR_SESSION_COOKIE = 'operator_session';
exports.OPERATOR_SESSION_TTL_SECONDS = 15 * 60;
function requiredAuthEnv(name) { const value = process.env[name]?.trim(); if (!value)
    throw new Error(`${name} is required`); return value; }
function loadAuthConfig() { return { username: requiredAuthEnv('OPERATOR_USERNAME'), passwordHash: requiredAuthEnv('OPERATOR_PASSWORD_HASH'), jwtSecret: requiredAuthEnv('JWT_SECRET') }; }
let AuthService = class AuthService {
    config;
    constructor(config = loadAuthConfig()) {
        this.config = config;
    }
    async authenticate(request) {
        if (request.username !== this.config.username || !(await bcryptjs_1.default.compare(request.password, this.config.passwordHash)))
            return null;
        return jsonwebtoken_1.default.sign({ sub: this.config.username, role: 'operator' }, this.config.jwtSecret, {
            algorithm: 'HS256',
            expiresIn: exports.OPERATOR_SESSION_TTL_SECONDS,
        });
    }
    verify(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, this.config.jwtSecret, { algorithms: ['HS256'] });
            if (typeof payload === 'string' || payload.sub !== this.config.username || payload.role !== 'operator')
                return null;
            return { sub: payload.sub, role: 'operator' };
        }
        catch {
            return null;
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map