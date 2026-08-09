#!/usr/bin/env bash
# Human evidence collection wizard for roadmap phases 0, 3 and 6.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
WIZARD_TEMPLATE="$PROJECT_ROOT/.agents/skills/wizard/template.sh"

if [[ ! -f "$WIZARD_TEMPLATE" ]]; then
  printf 'Missing wizard library: %s\n' "$WIZARD_TEMPLATE" >&2
  exit 1
fi

# Source the template's library verbatim, stopping before its example stages.
source <(awk '/^# STAGES —/{exit} {print}' "$WIZARD_TEMPLATE")
cd "$PROJECT_ROOT"

TOTAL_STAGES=5
banner "八字项目人工验收"

stage "审核身份与排盘口径"
say "先构建确定性核心并初始化三个 git-ignored 审核文件。"
npm run build
node scripts/review-cli.mjs init
step "填写稳定的审核人代号、问真版本/日期，以及问真排盘设置。"
node scripts/review-cli.mjs setup

stage "问真兼容观察"
say "将逐项展示出生输入、本地输出和采用配置。每条记录保存后即可安全中断。"
open_url "https://pcbz.iwzwh.com/"
step "在问真使用向导显示的相同输入和设置，复制四柱、校正时间、起运和大运。"
step "把截图放进 review/screenshots/，然后粘贴相对路径。"
warn "完整验收有 120 条；可 Ctrl-C 中断，重新运行向导会从下一条继续。"
node scripts/review-cli.mjs wenzhen --limit 120

stage "关系规则人工审核"
say "生产草案规则必须逐条批准；依赖旺衰喜忌的规则只能保留为 research。"
step "对每条规则核对原 Word 文档来源、条件、语气和是否可进入生产报告。"
node scripts/review-cli.mjs rules --limit 999

stage "匿名真实案例标注"
say "案例文件包含敏感出生资料，已被 git 忽略；不得填写姓名、电话、邮箱或详细地址。"
step "录入至少 20 个已获授权的匿名案例，以及人工预期规则和主题。"
node scripts/review-cli.mjs cases

stage "指标与完成门禁"
say "先运行全部自动测试，再计算问真匹配率、规则审核状态和案例指标。"
npm run check
npm test
if node scripts/review-cli.mjs validate; then
  say "所有人工证据门禁已满足，可以进入最终规则修正与验收。"
else
  warn "仍有人工门禁未满足。重新运行向导会保留现有进度并继续。"
  SKIPPED+=("人工验收门禁尚未全部满足；运行 node scripts/review-cli.mjs validate 查看进度")
fi

finish
