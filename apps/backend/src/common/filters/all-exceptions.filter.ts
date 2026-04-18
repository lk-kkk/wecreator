import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
      // class-validator 返回的是数组
      if (Array.isArray(message)) {
        message = message.join('; ');
      }
    } else if (exception instanceof Error) {
      // P0-02: 生产环境不向客户端暴露内部错误信息
      this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
      if (process.env.NODE_ENV === 'production') {
        message = '服务器内部错误';
      } else {
        message = exception.message;
      }
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
      timestamp: Date.now(),
    });
  }
}
