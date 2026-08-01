# SloppySale — spec

Este documento existe antes que el código. No es documentación de lo
que ya hicimos: es la decisión de qué íbamos a hacer. El código, las
pruebas y el deployment se revisan contra esto.

## 1. Qué estamos construyendo

Una venta de tokens que streamea.

Mientras haya inventario, cualquiera manda ETH y compra tokens a un
precio fijo. Los tokens no se entregan de una: en la misma transacción
se despliega un contrato de vesting a nombre del comprador y su reloj
arranca **en ese instante**. Nada se libera por 30 segundos; ahí cae el
5% de golpe y el resto gotea segundo a segundo durante 10 minutos. El
comprador retira lo liberado cuando quiera. El dueño de la venta se
queda con el ETH.

Números, todos horneados en el bytecode:

| | |
|---|---|
| Precio | 1 ETH = 100,000 SLOP |
| Stream | 10 minutos desde la compra |
| Cliff | 30 segundos (un veinteavo: 5%) |
| Ritmo | ~166.67 SLOP por segundo por cada ETH |
| Inventario | 10,000,000 SLOP |
| Compras por dirección | Una |

## 2. Las preguntas que respondimos antes de escribir código

| Pregunta | Decisión | Por qué |
|---|---|---|
| ¿Cuándo arranca el stream de cada quien? | En su compra, `block.timestamp` | El producto es la gratificación inmediata: comprás y ves el número correr. Cada comprador estrena su propio reloj. |
| ¿Se puede comprar dos veces? | No, revierte con `AlreadyBought` | `VestingWallet` trata todo token que llega tarde como si hubiera estado desde `start`: una segunda compra a un reloj avanzado quedaría parcialmente liberada al instante. Una dirección, un stream, sin atajo. |
| ¿Hay ventana de venta? | No: abierta mientras haya inventario | Con relojes por comprador, cerrar la venta no protege nada. Cuando se agota, se acabó. Un concepto menos. |
| ¿Un contrato de vesting por comprador, o un mapping adentro de la venta? | Uno por comprador | `VestingWallet` de OpenZeppelin ya hace la matemática, está auditado y es de un solo beneficiario. No escribimos ni una línea de aritmética de vesting. Cuesta el gas de desplegar un contrato por compra. |
| ¿El precio, la duración o el cliff pueden cambiar? | No: son `constant` | Están horneados en el bytecode, iguales en cualquier despliegue. Lo único que se elige al desplegar es qué token se vende. |
| ¿El dev puede sacar los tokens? | No. Solo el ETH | No existe la función. Los tokens vendidos están en el stream de cada comprador y no hay camino de vuelta. Es la propiedad más importante del contrato. |
| ¿Y los tokens que no se vendan? | Quedan encerrados | Aceptamos el costo a cambio de no tener una función de rescate que también sirva para vaciar la venta. Se fondea solo lo que se está dispuesto a vender. |
| ¿Hay reembolsos? | No | Una vez comprado, el ETH es del dev y los tokens del comprador. |
| ¿Quién puede disparar el retiro? | Cualquiera, pero los tokens van al comprador | Viene de `VestingWallet`. Permite que un bot pague el gas sin ningún riesgo. |
| ¿Es actualizable? | No | Sin proxy, sin admin, sin pausa. Menos superficie que revisar. |

## 3. El calendario

Sea `total` lo que compró una persona y `COMPRA` el timestamp de su
compra:

```
libre(t) = 0                                si t <  COMPRA + CLIFF
libre(t) = total * (t - COMPRA) / DURACION  si cliff <= t < fin
libre(t) = total                            si t >= COMPRA + DURACION
```

El cliff no retrasa el calendario, lo bloquea. Cuando vence, se libera
de golpe todo el tiempo que ya había corrido.

Con 1 ETH (100,000 SLOP):

| Momento | Puede retirar | % |
|---|---:|---:|
| La compra (arranca el reloj) | 0.00 | 0.00% |
| 1 segundo antes del cliff | 0.00 | 0.00% |
| Cliff (segundo 30) | 5,000.00 | 5.00% |
| Minuto 1 | 10,000.00 | 10.00% |
| Minuto 2:30 | 25,000.00 | 25.00% |
| Minuto 5 | 50,000.00 | 50.00% |
| Minuto 10 (fin) | 100,000.00 | 100.00% |

## 4. Actores y permisos

| Actor | Puede | No puede |
|---|---|---|
| Dev (dueño) | Retirar el ETH recaudado, cuando quiera | Tocar los tokens, cambiar el precio, cambiar el calendario, cancelar una compra |
| Comprador | Comprar una vez, mientras haya inventario; retirar lo liberado según su calendario | Comprar dos veces con la misma dirección, adelantar su reloj, pedir reembolso |
| Cualquiera | Disparar el retiro de otro y pagar el gas | Redirigir los tokens de nadie |

## 5. Invariantes

Estas son las propiedades que se verifican con fuzzing e invariant
testing, no solo con ejemplos:

1. Lo que queda sin vender más lo vendido es siempre el inventario
   original: no se crean ni se pierden tokens.
2. Cada token vendido está en el stream de su comprador o ya en su
   billetera. En ningún otro lado.
3. El ETH solo puede estar en la venta o en manos del dev.
4. Antes de su propio cliff, ningún comprador tiene ni un token.
5. El dev nunca tiene tokens.
6. El stream de cada comprador es suyo y su reloj arrancó exactamente
   en su compra: cliff 30 segundos después, fin a los 10 minutos.

## 6. Fuera de alcance

- Whitelist, límites por dirección o rondas con precios distintos.
- Reembolsos y cancelaciones.
- Rescatar los tokens no vendidos.
- Vender por un ERC-20 en vez de ETH.
- Multi-cadena o hosting del frontend.

## 7. Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Segunda compra a un reloj avanzado | Tokens parcialmente liberados al llegar | `AlreadyBought`: una compra por dirección. Verificado con prueba y con invariante |
| Sybil: el mismo humano compra con N direcciones | Cada dirección estrena reloj propio | Aceptado: cada stream es honesto por separado; no hay nada que adelantar |
| Fondear con menos tokens de los que se van a vender | Las compras revierten con `InsufficientInventory` | El frontend muestra el inventario sin vender y el botón se apaga si no alcanza |
| Fondear de más | Los tokens que sobren quedan encerrados para siempre | Documentado; es la contracara de no tener función de rescate |
| Token equivocado o con decimales distintos de 18 | Las cuentas del precio no dan | Es lo único que se elige al desplegar: revisión humana de una sola dirección |
| Token con comisión o rebase | El comprador recibe menos de lo que dice el contrato | Documentado: este contrato no sirve para esos tokens |
| El dev pierde la llave del dueño | El ETH recaudado queda encerrado | Desplegar desde un multisig o una llave que de verdad esté respaldada |
| Comprar cuesta más gas de lo esperado | Cada compra despliega un contrato (~676k de gas) | Documentado; es el precio de reusar `VestingWallet` en vez de escribir la aritmética |
| Llaves privadas en el mismo ambiente donde corre un agente | Robo de fondos | El deployment de producción se hace en otra máquina o partición, con `cast wallet` o hardware wallet |

## 8. Criterios de aceptación

Cada regla del spec tiene al menos una prueba que la verifica. Las de
`test/` corren contra los contratos; las de `web/e2e/` corren contra el
producto completo en un navegador real, y por eso mismo también cubren
la capa `web/src/chain/`, que es la única parte del frontend que habla
con los contratos.

| Regla | Prueba |
|---|---|
| Todo está horneado | `test_EverythingIsBakedIn` |
| 1 ETH arranca un stream con 100,000 tokens | `test_BuyingOneEthStartsAStreamWithAHundredThousandTokens` |
| El reloj arranca en la compra | `test_TheClockStartsAtThePurchase` |
| Cada comprador tiene su propio reloj | `test_EachBuyerGetsTheirOwnClock` |
| No se compra dos veces | `test_RevertWhen_BuyingTwice` |
| No se compra sin ETH | `test_RevertWhen_BuyingWithoutEth` |
| No se vende más de lo que hay | `test_RevertWhen_InventoryDoesNotCover` |
| El ETH solo entra comprando | `test_EthOnlyEntersThroughBuy` |
| Nada antes del cliff | `test_NothingUnlocksBeforeTheCliff` |
| El cliff suelta el 5% de golpe | `test_TheCliffDropsFivePercentAtOnce` |
| A la mitad va la mitad | `test_HalfwayThroughHalfIsUnlocked` |
| Cada segundo libera su parte | `test_EverySecondUnlocksItsShare` |
| Al final se retira todo | `test_AtTheEndEverythingIsClaimable` |
| Retirar en tandas da lo mismo | `test_ClaimingInSipsEqualsClaimingInOneGulp` |
| El retiro es permissionless pero el destino es fijo | `test_AnyoneCanTriggerTheClaimButTheBuyerGetsPaid` |
| El dev retira el ETH | `test_TheDevWithdrawsTheEthRaised` |
| Un extraño no retira el ETH | `test_RevertWhen_AStrangerWithdrawsTheEth` |
| El dev no puede tocar los tokens vendidos | `test_TheDevCannotTouchSoldTokens` |
| El stream nunca corre adelantado | `testFuzz_TheStreamNeverRunsAheadOfItsSchedule` |

Y de punta a punta, desde el navegador:

| Regla | Prueba end to end |
|---|---|
| La venta muestra precio e inventario | `la venta muestra el precio y el inventario` |
| Comprar arranca el stream al instante | `comprar 1 ETH arranca el stream en ese mismo instante` |
| La cotización es fiel al monto | `la cotizacion sigue lo que escribis` |
| Una compra por dirección | `no se puede comprar dos veces con la misma cuenta` |
| Antes del cliff, nada; el countdown corre | `antes del cliff no se puede retirar y el countdown corre` |
| El cliff suelta 5,000 y se pueden retirar | `en el cliff caen 5,000 de golpe y se pueden retirar` |
| El contador corre en pantalla | `el numero sube solo mientras miras la pagina` |
| La gráfica avanza en vivo | `la aguja de la grafica avanza en vivo` |
| Al final sale todo | `al final del stream se retira todo` |
| Retiros parciales | `dos retiros: en el cliff y a la mitad` |
| El dev retira el ETH y no tiene forma de sacar tokens | `el dev retira el ETH y no ve ninguna forma de sacar tokens` |
| El panel del dev es solo del dev | `un comprador no ve el panel del dev` |
| Cada comprador ve solo lo suyo | `cada comprador ve solo lo suyo` |
