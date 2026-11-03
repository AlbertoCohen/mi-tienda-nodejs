#!/usr/bin/env bash
set -e
echo "=========================================================="
echo " INICIANDO E-COMMERCE MODULAR DE MODA: GAUNTLET OMEGA    "
echo "=========================================================="
echo "1. Instalando dependencias de Backend y Frontend..."
npm run install:all

echo "2. Compilando cliente React..."
npm run build:client

echo "3. Levantando servidor Express..."
npm start
