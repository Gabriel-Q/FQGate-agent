[CmdletBinding()]
param(
    [switch]$Uninstall,
    [string]$FQGatePath,
    [string]$McpUrl = "http://127.0.0.1:17281/mcp"
)

$ErrorActionPreference = "Stop"
$skillsTouched = $false

trap {
    if (-not $Uninstall -and $skillsTouched) {
        # 连接验收失败时撤销本次技能和 MCP 写入，避免留下半个千问入口。
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -Uninstall *> $null
        }
        catch { }
    }
    Write-Output "安装没有完成：$($_.Exception.Message)"
    exit 1
}

function Get-QianwenNodePath {
    $bundledNode = Join-Path $env:LOCALAPPDATA "Qianwen\User Data\qwen-agent\resources\bins\node.exe"
    if (Test-Path -LiteralPath $bundledNode -PathType Leaf) { return $bundledNode }
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $nodeCommand) { return $nodeCommand.Source }
    throw "没有找到可用的 Node.js。请先升级或修复千问客户端后重试。"
}

$installerPath = Join-Path $PSScriptRoot "install.ps1"
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "安装包不完整，缺少：$installerPath"
}

if ($Uninstall) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -Uninstall
    if ($LASTEXITCODE -ne 0) { throw "千问入口卸载失败。" }
    exit 0
}

# 先让安装器完成所有账号的冲突预检和写入；只有成功返回后才允许失败回滚触碰本次入口。
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath
if ($LASTEXITCODE -ne 0) { throw "千问入口安装失败。" }
$skillsTouched = $true

$configurePath = Join-Path $PSScriptRoot "scripts\configure-fqgate.mjs"
if (-not (Test-Path -LiteralPath $configurePath -PathType Leaf)) {
    throw "安装包不完整，缺少：$configurePath"
}
if ([string]::IsNullOrWhiteSpace($FQGatePath)) {
    $fqgateInstallerPath = Join-Path $PSScriptRoot "scripts\install-fqgate.ps1"
    if (-not (Test-Path -LiteralPath $fqgateInstallerPath -PathType Leaf)) {
        throw "安装包不完整，缺少：$fqgateInstallerPath"
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $fqgateInstallerPath -McpUrl $McpUrl
    if ($LASTEXITCODE -ne 0) { throw "FQGate 主程序安装或连接失败。" }
}
else {
    $nodePath = Get-QianwenNodePath
    & $nodePath $configurePath configure --mcp-url $McpUrl --require-ready --json --fqgate-path $FQGatePath
    if ($LASTEXITCODE -ne 0) {
        throw "FQGate 连接配置失败；请用 -FQGatePath 指定 FQGate 可执行文件。"
    }
}

Write-Output "安装完成。FQGate 已连接；请在千问中新建工作任务验证。"
