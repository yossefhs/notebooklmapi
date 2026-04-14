#!/bin/bash

# S'assurer d'installer le paquet Python notebooklm-py
pip install notebooklm-py || pip3 install notebooklm-py

# Lancer le serveur Express
node index.js
