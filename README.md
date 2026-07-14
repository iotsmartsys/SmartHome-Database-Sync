# Smart Home Database Sync

Serviço Node.js que recebe eventos MQTT de dispositivos, valida seus contratos, sincroniza-os com a API Smart Home e publica os eventos resultantes.

## Arquitetura

```text
MQTT → interfaces/mqtt → application → domain → infrastructure/http
                              ↓
                         eventos de saída → MQTT
```

- `interfaces/mqtt`: valida payloads, roteia tópicos e publica eventos.
- `application`: casos de uso de discovery, property e capability.
- `domain`: mapeamentos e regras puras.
- `infrastructure/http`: cliente HTTP e gateway da API de dispositivos.

## Pré-requisitos

- Node.js 20 ou superior.
- Acesso ao broker MQTT e à API configurados no ambiente.

## Configuração

Copie `.env.example` para `.env` ou `.local.env` e preencha os valores reais. Esses arquivos não devem ser versionados.

Variáveis obrigatórias:

- `API_URL`: URL HTTP/HTTPS da API.
- `MQTT_HOST`: host do broker.

`MQTT_USER_NAME` e `MQTT_PASSWORD` são opcionais, mas devem ser informados juntos. Os tópicos possuem defaults definidos em `src/app/utils/config.js`.

## Execução

```bash
cd src
npm ci
npm start
```

Na raiz do repositório:

```bash
make run    # usa .env
make local  # usa .local.env
```

## Qualidade

```bash
cd src
npm test
npm run test:unit
npm run test:integration
npm run lint
npm run format:check
```

Os testes de integração usam apenas um servidor HTTP local efêmero e um cliente MQTT falso; não acessam serviços externos.

## Fluxos MQTT

| Entrada                          | Finalidade                                              |
| -------------------------------- | ------------------------------------------------------- |
| `MQTT_TOPIC`                     | Atualização de capability.                              |
| `MQTT_TOPIC_SMARTHOME_DISCOVERY` | Discovery de dispositivo ou atualização de propriedade. |

Eventos publicados:

| Saída                            | Finalidade                                               |
| -------------------------------- | -------------------------------------------------------- |
| `MQTT_PUBLISH_TOPIC`             | Capability persistida com sucesso.                       |
| `MQTT_TOPIC_SMARTHOME_DISCOVERY` | Pedido de discovery para dispositivo Zigbee inexistente. |

## Operação

Os logs são estruturados, incluem `correlationId` por mensagem MQTT e ocultam credenciais. Erros de validação não são reenviados; falhas transitórias de infraestrutura são marcadas como `retryable` nos logs.
