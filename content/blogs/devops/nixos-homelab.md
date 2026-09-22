---
title: Building a NixOS Homelab
date: 2026-05-12
description: Rebuilding my homelab declaratively with NixOS flakes — reproducible, version-controlled infrastructure at home.
tags: [nixos, homelab, devops, linux]
---

# Building a NixOS Homelab

After one too many "what did I install on this box?" moments, I rebuilt my entire
homelab on **NixOS**. Everything is declarative now — the whole machine is one
git repo.

## The flake

```nix
{
  description = "homelab";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: {
    nixosConfigurations.box = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [ ./configuration.nix ];
    };
  };
}
```

## Why it's worth it

- **Reproducible** — `nixos-rebuild switch` gets me an identical machine every time.
- **Rollbacks** — bad config? boot the previous generation.
- **Documented by default** — the config _is_ the documentation.

```bash
# rebuild and switch
sudo nixos-rebuild switch --flake .#box

# roll back if it broke
sudo nixos-rebuild switch --rollback
```

> NixOS is a rabbit hole. A very good rabbit hole.

It took a weekend to learn, but I haven't lost track of a single service since.
