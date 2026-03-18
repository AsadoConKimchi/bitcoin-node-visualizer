#!/usr/bin/env bash
# Umbrel internal environment exports for Bitcoin Node Visualizer
export APP_PORT=3000
export APP_BITCOIN_NODE_IP="${BITCOIN_IP:-bitcoin}"
export APP_BITCOIN_RPC_PORT="${BITCOIN_RPC_PORT:-8332}"
export APP_BITCOIN_RPC_USER="${BITCOIN_RPC_USER:-umbrel}"
export APP_BITCOIN_RPC_PASS="${BITCOIN_RPC_PASS:-umbrel}"
export APP_BITCOIN_ZMQ_RAWBLOCK_PORT=28332
export APP_BITCOIN_ZMQ_RAWTX_PORT=28333
export BITCOIN_NETWORK_NAME="${BITCOIN_NETWORK_NAME:-bitcoin_default}"
