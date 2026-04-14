#!/bin/bash

# Ajouter le dossier bin local de Python au PATH
export PATH=$PATH:$HOME/.local/bin:$(python3 -m site --user-base)/bin

# S'assurer d'installer le paquet Python notebooklm-py
pip install --user notebooklm-py || pip3 install --user notebooklm-py

# Lancer le serveur Express
node index.js
