# Form configuration

Owns the `admin-form-config` route, form metadata list, enum previews, per-form field details, and modification-history demo data.

The module keeps its selected form as local UI state. Shared page headers, filters, pagination, modal actions, and shell notifications remain host services.

The abnormal-complaint form also owns a maintainable DOCX attachment template. Only the `technology-super-admin` profile can upload a replacement. The prototype accepts ZIP-backed DOCX files up to 2 MB, and `XIBAdminFormTemplateStore` persists the latest browser-local template and its update history under `xib-admin-form-template-overrides-v1`; the subprocess upload field reads that documented contract and falls back to `templates/异常投诉识别情况报告.docx` when no override exists. Production integration must replace this browser-local store with the shared file service so every user receives the same maintained template.
