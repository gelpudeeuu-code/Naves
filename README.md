# NAVES — Asalto Estelar

Juego de naves en 3D para el navegador. Elige una de las tres naves, atraviesa tres sectores y derrota a sus jefes.

## Cómo jugar

Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge, Safari). No necesita instalación, servidor ni conexión a internet. Funciona en ordenador y en móvil.

| Acción | Teclado | Táctil / ratón |
| --- | --- | --- |
| Mover | WASD o flechas | Arrastrar en la pantalla |
| Disparar | Automático | Automático |
| Especial | X, E o Mayús | Botón inferior derecho |
| Pausa | P o Esc | Botón ❚❚ |
| Sonido | M | Botón ♪ |
| Elegir nave (menú) | ← → o 1 2 3, Enter para despegar | Tocar la tarjeta |

## Naves

| Nave | Estilo | Arma | Especial |
| --- | --- | --- | --- |
| **Halcón** | Equilibrada | Doble cañón | Salva de misiles teledirigidos |
| **Centella** | Rápida y frágil | Disparo en abanico | Sobrecarga: invulnerable y fuego doble durante 6 s |
| **Titán** | Lenta y acorazada | Cañón pesado perforante | Onda de choque que limpia la pantalla |

## Sectores y jefes

1. **Frontera Azul** — jefe: **Centinela**, acorazado con torretas.
2. **Cinturón Carmesí** (campo de asteroides) — jefe: **Hidra**, colmena de tres brazos giratorios.
3. **Núcleo Oscuro** — jefe: **Leviatán**, con rayos láser y tres fases.

Al vencer al Leviatán puedes continuar en un nuevo ciclo más difícil.

## Objetos

- **Dorado**: sube el nivel del arma (hasta 4).
- **Verde**: repara el blindaje.
- **Morado**: añade una carga de especial.

Encadenar derribos sin recibir daño aumenta el multiplicador de puntos (hasta ×8). El récord se guarda en el navegador.

## Estructura

- `index.html`, `style.css` — interfaz.
- `js/util.js` — utilidades y sonido (sintetizado con WebAudio, sin archivos de audio).
- `js/models.js` — modelos 3D procedurales (no hay archivos de modelos ni texturas).
- `js/game.js` — motor del juego.
- `vendor/three.min.js` — [three.js](https://threejs.org) r170 (licencia MIT, ver `vendor/THREE-LICENSE.txt`).

Añadir `?debug` a la URL expone `window.NAVES` con ayudas para pruebas (saltar al jefe, cambiar de sector, etc.).
