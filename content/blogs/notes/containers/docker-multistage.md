---
title: Smaller Images with Multi-stage Builds
date: 2026-04-08
description: Cutting a Go image from 900MB to 12MB with multi-stage Docker builds and distroless base images.
tags: [docker, containers, go, devops]
---

# Smaller Images with Multi-stage Builds

A naive Dockerfile ships the entire build toolchain to production. Multi-stage
builds let you compile in one stage and copy _only the binary_ into a tiny final
image.

## Before — 900MB

```dockerfile
FROM golang:1.22
WORKDIR /app
COPY . .
RUN go build -o server .
CMD ["./server"]
```

## After — 12MB

```dockerfile
# build stage
FROM golang:1.22 AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o server .

# final stage
FROM gcr.io/distroless/static
COPY --from=build /app/server /server
ENTRYPOINT ["/server"]
```

The `distroless/static` base has no shell, no package manager, nothing but your
binary and the certs it needs.

| Image                | Size   |
| -------------------- | ------ |
| `golang:1.22`        | 900 MB |
| `alpine` + binary    | 25 MB  |
| `distroless` + binary| 12 MB  |

Smaller images pull faster, have a smaller attack surface, and cost less to store.
