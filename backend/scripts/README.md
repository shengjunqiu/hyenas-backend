# 手动脚本

## `update-merchant-status-from-mark.js`

读取项目根目录的 `res/mark.json`，使用其中的 `许可证编码` 匹配 `merchants.license_no`，并将匹配到的商家状态批量更新为指定状态，默认状态编码为 `waiter`。

执行示例：

```bash
cd backend
node scripts/update-merchant-status-from-mark.js --dry-run
node scripts/update-merchant-status-from-mark.js --operator-username=admin
```

可选参数：

```bash
--file=PATH
--status-name=NAME
--status-code=CODE
--operator-id=ID
--operator-username=NAME
--remark=TEXT
--dry-run
```

说明：

- 默认读取 `../res/mark.json`
- 默认目标状态编码为 `waiter`
- 默认备注为 `根据 mark.json 批量更新为推流状态`
- 未显式指定操作人时，会回退到第一个启用中的超级管理员
- 建议先跑 `--dry-run` 确认匹配数量，再正式执行
