
REGISTRY="centraliot.azurecr.io"
IMAGE_NAME="central-iot-database-sync"
VERSION="v1.0"

DATE_TAG=$(date +%Y%m%d%H%M)

UNIQUE_TAG="$VERSION.$DATE_TAG"

FULL_TAG="$REGISTRY/$IMAGE_NAME:$UNIQUE_TAG"
LATEST_TAG="$REGISTRY/$IMAGE_NAME:latest"

echo "-------------------------------------------------------"
echo "     Iniciando build da imagem Docker"
echo "-------------------------------------------------------"
echo "Usando tags:"
echo "  1) $FULL_TAG"
echo "  2) $LATEST_TAG"
echo

docker buildx build --platform=linux/arm64/v8 -t "$FULL_TAG" -t "$LATEST_TAG" ./

echo
echo "-------------------------------------------------------"
echo "     Realizando push da imagem Docker"
echo "-------------------------------------------------------"
docker push "$FULL_TAG"
docker push "$LATEST_TAG"

echo
echo "-------------------------------------------------------"
echo " Build e push finalizados com sucesso!"
echo "-------------------------------------------------------"
echo "Imagem gerada com tag única: $FULL_TAG"
echo "Imagem gerada com tag latest: $LATEST_TAG"
