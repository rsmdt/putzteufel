import { type PluginDef } from './api.ts';
import appCaches from './app-caches.ts';
import bazel from './bazel.ts';
import bun from './bun.ts';
import bundler from './bundler.ts';
import cabal from './cabal.ts';
import cacheTag from './cache-tag.ts';
import cargo from './cargo.ts';
import carthage from './carthage.ts';
import claude from './claude.ts';
import cmake from './cmake.ts';
import cocoapods from './cocoapods.ts';
import composer from './composer.ts';
import conda from './conda.ts';
import corepack from './corepack.ts';
import cypress from './cypress.ts';
import dart from './dart.ts';
import deno from './deno.ts';
import docker from './docker.ts';
import dotnet from './dotnet.ts';
import electron from './electron.ts';
import elixir from './elixir.ts';
import expo from './expo.ts';
import flutter from './flutter.ts';
import go from './go.ts';
import godot from './godot.ts';
import gradle from './gradle.ts';
import homebrew from './homebrew.ts';
import huggingface from './huggingface.ts';
import installers from './installers.ts';
import jetbrains from './jetbrains.ts';
import logs from './logs.ts';
import maven from './maven.ts';
import mise from './mise.ts';
import nix from './nix.ts';
import nodeGyp from './node-gyp.ts';
import node from './node.ts';
import npm from './npm.ts';
import pip from './pip.ts';
import pixi from './pixi.ts';
import playwright from './playwright.ts';
import pnpm from './pnpm.ts';
import podman from './podman.ts';
import poetry from './poetry.ts';
import preCommit from './pre-commit.ts';
import prisma from './prisma.ts';
import puppeteer from './puppeteer.ts';
import python from './python.ts';
import pytorch from './pytorch.ts';
import reactNative from './react-native.ts';
import rubygems from './rubygems.ts';
import sbt from './sbt.ts';
import stack from './stack.ts';
import swift from './swift.ts';
import terraform from './terraform.ts';
import trash from './trash.ts';
import typescript from './typescript.ts';
import unity from './unity.ts';
import unreal from './unreal.ts';
import uv from './uv.ts';
import vscode from './vscode.ts';
import xcode from './xcode.ts';
import xdgCaches from './xdg-caches.ts';
import yarn from './yarn.ts';
import zig from './zig.ts';

export const builtinPlugins: PluginDef[] = [
  appCaches,
  bazel,
  bun,
  bundler,
  cabal,
  cargo,
  carthage,
  claude,
  cmake,
  cocoapods,
  composer,
  conda,
  corepack,
  cypress,
  dart,
  deno,
  docker,
  dotnet,
  electron,
  elixir,
  expo,
  flutter,
  go,
  godot,
  gradle,
  homebrew,
  huggingface,
  installers,
  jetbrains,
  logs,
  maven,
  mise,
  nix,
  nodeGyp,
  node,
  npm,
  pip,
  pixi,
  playwright,
  pnpm,
  podman,
  poetry,
  preCommit,
  prisma,
  puppeteer,
  python,
  pytorch,
  reactNative,
  rubygems,
  sbt,
  stack,
  swift,
  terraform,
  trash,
  typescript,
  unity,
  unreal,
  uv,
  vscode,
  xcode,
  xdgCaches,
  yarn,
  zig,
  cacheTag,
];
