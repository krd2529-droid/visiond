# v0.20.101 — remove white connection-management action

Removed the generated white `จัดการการเชื่อมต่อ` action and its exclusive helper, listener, visibility writes and CSS. Kept Tiffany product navigation, disconnected-channel Shop recovery and all connection/provider APIs unchanged. Successful loads remain guarded by current channel ownership, sequence and date range.

Actual-source regression exercises initial insertion, connected/disconnected A→B→A, late connected/disconnected responses, stale date range and no-selection cleanup with the removed node genuinely null. Focused101/100/91/70 and full canonical101→72 pass. Visible101, predeploy9PASS8existingWARN0FAIL and diff check pass. JS02159/CSS02100. No schema/native/data changes; release pending independent review.
