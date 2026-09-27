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
        # 连接验收失败时撤销本次技能写入，避免只留下半个豆包入口。
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -Uninstall *> $null
        }
        catch { }
    }
    Write-Output "安装没有完成：$($_.Exception.Message)"
    exit 1
}

function Get-DoubaoNodePath {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $nodeCommand) { return $nodeCommand.Source }
    $runtimeRoot = Join-Path $env:LOCALAPPDATA "Doubao\User Data\sandbox_runtime\bases"
    if (Test-Path -LiteralPath $runtimeRoot -PathType Container) {
        $runtimeNode = Get-ChildItem -LiteralPath $runtimeRoot -Filter node.exe -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "\\node\\node\.exe$" } |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1
        if ($null -ne $runtimeNode) { return $runtimeNode.FullName }
    }
    throw "没有找到可用的 Node.js。请先升级或修复豆包客户端后重试。"
}

$installerPath = Join-Path $PSScriptRoot "install.ps1"
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "安装包不完整，缺少：$installerPath"
}

if ($Uninstall) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -Uninstall
    if ($LASTEXITCODE -ne 0) { throw "豆包技能卸载失败。" }
    exit 0
}

# 先让安装器完成宿主技能预检和写入；只有成功返回后才允许失败回滚触碰本次入口。
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath
if ($LASTEXITCODE -ne 0) { throw "豆包技能安装失败。" }
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
    $nodePath = Get-DoubaoNodePath
    & $nodePath $configurePath configure --mcp-url $McpUrl --require-ready --json --fqgate-path $FQGatePath
    if ($LASTEXITCODE -ne 0) {
        throw "FQGate 连接配置失败；请用 -FQGatePath 指定 FQGate 可执行文件。"
    }
}

Write-Output "安装完成。FQGate 已连接；请在豆包工作任务中选中同花顺免费开源AI插件FQGate和连接器。"
