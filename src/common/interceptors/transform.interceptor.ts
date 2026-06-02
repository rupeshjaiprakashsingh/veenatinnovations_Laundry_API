import { Injectable, NestInterceptor, ArgumentsHost, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseFormat<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(context: ArgumentsHost, next: CallHandler): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
      })),
    );
  }
}
