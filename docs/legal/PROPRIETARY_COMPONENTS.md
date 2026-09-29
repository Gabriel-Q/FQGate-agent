# 非本仓库组件

FQGate 主程序在独立仓库中维护，不进入本 Agent 插件仓库。本仓库不保存主程序二进制、历史 MCP Apps 发布目录、调试符号、私钥、研究材料或用户数据。

主程序安装包只通过 [FQGate-releases](https://github.com/fqgate/FQGate-releases) 分发。MCP Apps 的原生 HTML/CSS/TypeScript 源码属于本仓库；构建后的当前快照由主程序仓库内置，签名更新版本由发行仓库提供。

任何构建或发布脚本都不得读取或复制无关私有源码、本机账号数据或签名私钥到工作区产物。
