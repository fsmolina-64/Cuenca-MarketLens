import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Rol, Usuario, PasswordResetToken } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; email: string; username: string; rol: Rol }> {
    const existingEmail = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('El correo ya está registrado');
    }

    const existingUsername = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '10');
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        rol: Rol.USUARIO,
      },
    });

    return {
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
      rol: usuario.rol,
    };
  }

  async validateUser(email: string, password: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.activo === false) {
      throw new ForbiddenException('Cuenta inhabilitada, contacte al administrador');
    }

    const passwordMatches = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return usuario;
  }

  private generarRespuestaAuth(usuario: Usuario) {
    const payload = { sub: usuario.id, rol: usuario.rol };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET')!,
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN')! as any,
    });

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        username: usuario.username,
        rol: usuario.rol,
      },
    };
  }

  async login(dto: LoginDto) {
    const usuario = await this.validateUser(dto.email, dto.password);
    return this.generarRespuestaAuth(usuario);
  }

  async loginAdmin(dto: LoginDto) {
    const usuario = await this.validateUser(dto.email, dto.password);
    if (usuario.rol !== Rol.ADMIN) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.generarRespuestaAuth(usuario);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ mensaje: string; token?: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + 60 * 60 * 1000); // ahora + 1 hora

      await this.prisma.passwordResetToken.create({
        data: {
          usuarioId: usuario.id,
          token,
          expiraEn,
          usado: false,
        },
      });

      // TODO: enviar `token` por email cuando exista un servicio de correo.

      const mensaje =
        process.env.NODE_ENV !== 'production'
          ? `Si el correo existe, recibirás instrucciones para restablecer tu contraseña. Token (solo dev): ${token}`
          : 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.';

      return { mensaje, ...(process.env.NODE_ENV !== 'production' ? { token } : {}) };
    }

    return {
      mensaje: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ mensaje: string }> {
    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!passwordResetToken) {
      throw new BadRequestException('Token inválido');
    }

    if (passwordResetToken.usado === true) {
      throw new BadRequestException('Token ya utilizado');
    }

    if (passwordResetToken.expiraEn < new Date()) {
      throw new BadRequestException('Token expirado');
    }

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '10');
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: passwordResetToken.usuarioId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { usado: true },
      }),
    ]);

    return { mensaje: 'Contraseña restablecida correctamente.' };
  }
}
