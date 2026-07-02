# YT Image Downloader

Extension de Chrome para descargar el banner, logo y thumbnail de canales y videos de YouTube.

## Funciones

- Detecta imagenes en paginas de **canal**, **video** y **Shorts**
- Panel flotante en la esquina inferior derecha de YouTube
- Popup para ver el estado y reescanear la pagina activa
- Descargas cross-origin mediante `chrome.downloads`
- Compatible con la navegacion SPA de YouTube

## Instalacion (modo desarrollador)

1. Clona este repositorio o descargalo como ZIP.
2. Abre Chrome y ve a `chrome://extensions/`.
3. Activa **Modo de desarrollador**.
4. Haz clic en **Cargar descomprimida**.
5. Selecciona la carpeta del proyecto.

## Uso

1. Abre un canal o video en YouTube.
2. Aparecera un panel flotante con las imagenes detectadas.
3. Haz clic en **Descargar** junto a cada imagen.
4. Tambien puedes abrir el popup de la extension para ver el estado o reescanear.

## Permisos

| Permiso | Motivo |
|---|---|
| `activeTab` | Interactuar con la pestana activa de YouTube |
| `scripting` | Comunicacion entre popup y content script |
| `downloads` | Guardar imagenes en disco |
| `host_permissions` | Acceder a imagenes en dominios de YouTube y Google |

## Limitaciones conocidas

- YouTube cambia su DOM con frecuencia; algunos selectores pueden dejar de funcionar.
- `maxresdefault` no existe para todos los videos; en ese caso la descarga puede fallar.
- La extension no funciona fuera de `youtube.com`.

## Estructura

```
manifest.json    # Configuracion MV3
background.js    # Service worker para descargas
content.js       # Deteccion de imagenes y panel flotante
popup.html/js    # Estado y reescaneo
icons/           # Iconos de la extension
```

## Licencia

MIT — ver [LICENSE](LICENSE).