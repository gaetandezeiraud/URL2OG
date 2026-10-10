FROM rust:1-slim-trixie AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    tini \
    &&rm -rf /var/lib/apt/lists/* \
    && useradd -m app
WORKDIR /app
COPY --from=build /src/target/release/url2og /usr/local/bin/url2og
RUN mkdir -p cache && chown app:app cache
EXPOSE 3000
USER app
# tini reaps the Chromium helper processes orphaned to PID 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["url2og"]
