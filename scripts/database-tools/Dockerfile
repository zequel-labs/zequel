FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential bison flex pkg-config libssl-dev zlib1g-dev liblz4-dev libzstd-dev ca-certificates python3 patchelf cmake curl libaio1t64 libncurses6 libncurses-dev libtinfo6 && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
