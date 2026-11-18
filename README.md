# TutoresOn-Line — Prototipo funcional (web + móvil)

Plataforma de tutorías académicas. Monorepo:

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST (Node 22, Express, SQLite embebido `node:sqlite`, JWT). Sirve también la web compilada. |
| `web/` | Aplicación web (React 18 + Vite). |
| `mobile/` | Aplicación móvil (Expo SDK 58 / React Native). |

## Cuentas de demostración (contraseña `demo1234`)
- Estudiante: `estudiante@demo.co`
- Tutores: `laura@demo.co`, `carlos@demo.co`, `mariana@demo.co`, `julian@demo.co`
- Administrador: `admin@tutoresonline.co`
- Tarjeta de pago simulada: `4242 4242 4242 4242` aprueba; terminada en `0002` es rechazada.

## Ejecutar en local
Requiere Node >= 22.13.
```bash
cd web && npm install && npm run build && cd ..
cd backend && npm install && npm start      # http://localhost:3000 (API + web)
npm test                                     # 4 pruebas de flujo completo
```
Desarrollo web con recarga: `cd web && npm run dev` (proxy a `localhost:3000`).

## Desplegar la web en la nube (Render, gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En https://render.com → **New → Blueprint** → elige el repositorio (usa `render.yaml`).
3. Al terminar, la URL `https://tutoresonline-xxxx.onrender.com` es el enlace a compartir.
   - Plan gratuito: la base SQLite se reinicia con cada despliegue/reposo y se vuelve a cargar con los datos demo (suficiente para el prototipo). Para persistencia: plan de pago + disco en `/var/data` y variable `DATA_DIR=/var/data`.
   - La primera visita tras inactividad tarda ~50 s en despertar.

## APK de la app móvil
1. Edita `mobile/app.json` → `expo.extra.apiUrl` con la URL de Render (sin `/` final).
   (También se puede cambiar en la pantalla de login de la app: campo "Servidor".)
2. ```bash
   cd mobile && npm install --legacy-peer-deps
   npm install -g eas-cli && eas login        # cuenta gratuita en expo.dev
   eas build -p android --profile preview     # genera el .apk (~15 min en la nube de Expo)
   ```
3. Al terminar, EAS entrega un enlace de descarga del `.apk`; instálalo en el teléfono Android.
- Probar sin APK: `npx expo start` y escanear el QR con **Expo Go** (misma red).

## Guion para el video de YouTube (3-5 min)
1. (0:00) Presentar el proyecto y el equipo; mostrar la URL de la web.
2. Web como estudiante: iniciar sesión, buscar tutores con filtros, ver perfil, reservar con pago (mostrar tarjeta `0002` rechazada y luego `4242` aprobada).
3. Web como tutor (otra ventana): aceptar la reserva; mostrar enlace de videollamada y panel de ingresos.
4. Tutoría inmediata: estudiante solicita, tutor en línea la acepta.
5. Finalizar y calificar; mostrar notificaciones.
6. Administrador: aprobar al tutor pendiente (Sofía), moderar calificaciones, estadísticas.
7. App móvil (APK en el teléfono o emulador): login, búsqueda, reserva, vista del tutor.
8. Cierre: propuesta económica y cronograma (PDF).
Grabar con OBS o la grabadora del teléfono; subir a YouTube como **No listado** y compartir el enlace.
