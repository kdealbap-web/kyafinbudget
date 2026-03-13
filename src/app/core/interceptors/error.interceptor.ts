import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/components/toast/toast.service';

/**
 * Interceptor funcional que captura errores HTTP globalmente,
 * los loggea en consola y muestra un toast de error.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const toast = inject(ToastService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            const message = buildErrorMessage(error);
            console.error('[HTTP Error]', error.status, message, error.url);
            toast.error(message);
            return throwError(() => error);
        })
    );
};

/** Construye un mensaje de error amigable según el código HTTP */
function buildErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
        return 'Sin conexión a internet. Verifica tu red.';
    }

    const messages: Record<number, string> = {
        400: 'Solicitud inválida.',
        401: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
        403: 'No tienes permisos para realizar esta acción.',
        404: 'Recurso no encontrado.',
        409: 'El registro ya existe.',
        422: 'Datos inválidos en la solicitud.',
        500: 'Error interno del servidor. Intenta más tarde.',
        503: 'Servicio no disponible. Intenta más tarde.',
    };

    return messages[error.status] ?? `Error inesperado (${error.status}).`;
}
