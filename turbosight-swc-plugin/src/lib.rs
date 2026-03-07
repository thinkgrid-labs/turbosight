use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

// ---------------------------------------------------------------------------
// Visitor — handles only `export default <expr>` (identifier / arrow / etc.)
// Does NOT touch `export default function Foo(){}` — that is handled separately.
// ---------------------------------------------------------------------------
pub struct ExprExportVisitor {
    pub filename: String,
    pub is_client: bool,
    pub wrapped: bool,
}

impl ExprExportVisitor {
    fn new(filename: String) -> Self {
        Self { filename, is_client: false, wrapped: false }
    }

    fn new_client(filename: String) -> Self {
        Self { filename, is_client: true, wrapped: false }
    }

    fn make_wrap_call(&self, expr: Box<Expr>, component_name: &str) -> Expr {
        Expr::Call(CallExpr {
            span: swc_core::common::DUMMY_SP,
            ctxt: swc_core::common::SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__turbosight_wrap".into(),
                swc_core::common::DUMMY_SP,
                swc_core::common::SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread { spread: None, expr },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: swc_core::common::DUMMY_SP,
                        value: self.filename.clone().into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: swc_core::common::DUMMY_SP,
                        value: component_name.into(),
                        raw: None,
                    }))),
                },
            ],
            type_args: None,
        })
    }
}

fn is_already_wrapped(expr: &Expr) -> bool {
    if let Expr::Call(call) = expr {
        if let Callee::Expr(callee) = &call.callee {
            if let Expr::Ident(ident) = &**callee {
                return ident.sym == "__turbosight_wrap";
            }
        }
    }
    false
}

impl VisitMut for ExprExportVisitor {
    // Handles: export default App  /  export default () => {}  /  export default function() {}
    // Does NOT run on export default function Foo(){} — that is an ExportDefaultDecl.
    fn visit_mut_export_default_expr(&mut self, n: &mut ExportDefaultExpr) {
        if !self.is_client {
            return;
        }
        // Safety guard: never double-wrap
        if is_already_wrapped(&n.expr) {
            return;
        }

        let component_name = match &*n.expr {
            Expr::Ident(ident) => ident.sym.to_string(),
            Expr::Fn(fn_expr) => fn_expr
                .ident
                .as_ref()
                .map(|i| i.sym.to_string())
                .unwrap_or_else(|| "AnonymousComponent".to_string()),
            Expr::Arrow(_) => "ArrowComponent".to_string(),
            _ => return, // skip non-component-like exports
        };

        let original = n.expr.clone();
        n.expr = Box::new(self.make_wrap_call(original, &component_name));
        self.wrapped = true;
    }
}

// ---------------------------------------------------------------------------
// Module-level pass — handles `export default function Foo(){}` and
// `export default class Foo {}` which require a node-type swap
// (ExportDefaultDecl → ExportDefaultExpr) that can't be done from a visitor.
// ---------------------------------------------------------------------------
fn transform_default_decl(module: &mut Module, filename: &str) -> bool {
    let mut injected = false;
    let mut i = 0;

    while i < module.body.len() {
        let is_fn_or_class = matches!(
            &module.body[i],
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(d))
            if matches!(&d.decl, DefaultDecl::Fn(_) | DefaultDecl::Class(_))
        );

        if !is_fn_or_class {
            i += 1;
            continue;
        }

        let item = module.body.remove(i);
        let ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(decl)) = item else {
            i += 1;
            continue;
        };

        let (component_name, fn_expr) = match decl.decl {
            DefaultDecl::Fn(fn_expr) => {
                let name = fn_expr
                    .ident
                    .as_ref()
                    .map(|id| id.sym.to_string())
                    .unwrap_or_else(|| "AnonymousComponent".to_string());
                (name, Box::new(Expr::Fn(fn_expr)))
            }
            DefaultDecl::Class(class_expr) => {
                let name = class_expr
                    .ident
                    .as_ref()
                    .map(|id| id.sym.to_string())
                    .unwrap_or_else(|| "AnonymousComponent".to_string());
                (name, Box::new(Expr::Class(class_expr)))
            }
            other => {
                module.body.insert(
                    i,
                    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
                        span: swc_core::common::DUMMY_SP,
                        decl: other,
                    })),
                );
                i += 1;
                continue;
            }
        };

        let wrapped = Expr::Call(CallExpr {
            span: swc_core::common::DUMMY_SP,
            ctxt: swc_core::common::SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__turbosight_wrap".into(),
                swc_core::common::DUMMY_SP,
                swc_core::common::SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread { spread: None, expr: fn_expr },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: swc_core::common::DUMMY_SP,
                        value: filename.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: swc_core::common::DUMMY_SP,
                        value: component_name.into(),
                        raw: None,
                    }))),
                },
            ],
            type_args: None,
        });

        module.body.insert(
            i,
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                span: swc_core::common::DUMMY_SP,
                expr: Box::new(wrapped),
            })),
        );
        injected = true;
        i += 1;
    }

    injected
}

fn make_import_decl() -> ModuleItem {
    ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
        span: swc_core::common::DUMMY_SP,
        specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
            span: swc_core::common::DUMMY_SP,
            local: Ident::new(
                "__turbosight_wrap".into(),
                swc_core::common::DUMMY_SP,
                swc_core::common::SyntaxContext::empty(),
            ),
            imported: None,
            is_type_only: false,
        })],
        src: Box::new(Str {
            span: swc_core::common::DUMMY_SP,
            value: "@think-grid-labs/turbosight".into(),
            raw: None,
        }),
        type_only: false,
        with: None,
        phase: ImportPhase::Evaluation,
    }))
}

fn first_non_directive_pos(module: &Module) -> usize {
    module
        .body
        .iter()
        .position(|item| {
            !matches!(
                item,
                ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. }))
                if matches!(&**expr, Expr::Lit(Lit::Str(_)))
            )
        })
        .unwrap_or(0)
}

fn is_client_module(module: &Module) -> bool {
    module.body.iter().any(|item| {
        matches!(
            item,
            ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. }))
            if matches!(&**expr, Expr::Lit(Lit::Str(s)) if s.value == *"use client")
        )
    })
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------
#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    metadata: TransformPluginProgramMetadata,
) -> Program {
    let filename = metadata
        .get_context(&swc_core::plugin::metadata::TransformPluginMetadataContextKind::Filename)
        .unwrap_or_else(|| "unknown_file".to_string());

    let Program::Module(ref mut module) = program else {
        return program;
    };

    if !is_client_module(module) {
        return program;
    }

    // Pass 1 — handle `export default <expr>` via visitor (identifiers, arrows, anon fns)
    let mut visitor = ExprExportVisitor::new_client(filename.clone());
    module.visit_mut_with(&mut visitor);

    // Pass 2 — handle `export default function Foo(){}` / class (requires node-type swap)
    // Runs AFTER the visitor so the two passes cover mutually exclusive node types.
    let decl_wrapped = transform_default_decl(module, &filename);

    // Inject the import once, after the last "use client" directive
    if visitor.wrapped || decl_wrapped {
        let pos = first_non_directive_pos(module);
        module.body.insert(pos, make_import_decl());
    }

    program
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::ecma::transforms::testing::test_inline;
    use swc_core::ecma::visit::visit_mut_pass;

    // ── Visitor pass: ExprExportVisitor ──────────────────────────────────────

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(ExprExportVisitor::new_client("test.tsx".to_string())),
        wraps_export_default_ident,
        r#"
            "use client";
            const App = () => "Hello";
            export default App;
        "#,
        r#"
            "use client";
            const App = () => "Hello";
            export default __turbosight_wrap(App, "test.tsx", "App");
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(ExprExportVisitor::new("test.tsx".to_string())),
        skips_non_client,
        r#"
            const App = () => "Hello";
            export default App;
        "#,
        r#"
            const App = () => "Hello";
            export default App;
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(ExprExportVisitor::new_client("test.tsx".to_string())),
        skips_already_wrapped,
        r#"
            "use client";
            export default __turbosight_wrap(App, "test.tsx", "App");
        "#,
        r#"
            "use client";
            export default __turbosight_wrap(App, "test.tsx", "App");
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(ExprExportVisitor::new_client("test.tsx".to_string())),
        skips_named_exports,
        r#"
            "use client";
            export const foo = 1;
        "#,
        r#"
            "use client";
            export const foo = 1;
        "#
    );

    // ── Module-level pass: transform_default_decl ────────────────────────────

    /// Helper visitor that runs transform_default_decl on the module.
    struct DeclPass {
        filename: String,
    }
    impl VisitMut for DeclPass {
        fn visit_mut_module(&mut self, module: &mut Module) {
            transform_default_decl(module, &self.filename);
        }
    }

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(DeclPass { filename: "test.tsx".to_string() }),
        wraps_export_default_named_fn,
        r#"
            export default function MyComponent() {}
        "#,
        r#"
            export default __turbosight_wrap(function MyComponent() {}, "test.tsx", "MyComponent");
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(DeclPass { filename: "test.tsx".to_string() }),
        wraps_export_default_anon_fn,
        r#"
            export default function() {}
        "#,
        r#"
            export default __turbosight_wrap(function() {}, "test.tsx", "AnonymousComponent");
        "#
    );

    // ── Full pipeline: visitor + decl pass + import injection ─────────────────

    /// Helper visitor that mirrors process_transform without the plugin metadata.
    struct FullPass {
        filename: String,
    }
    impl VisitMut for FullPass {
        fn visit_mut_module(&mut self, module: &mut Module) {
            if !is_client_module(module) {
                return;
            }
            let mut visitor = ExprExportVisitor::new_client(self.filename.clone());
            module.visit_mut_with(&mut visitor);
            let decl_wrapped = transform_default_decl(module, &self.filename);
            if visitor.wrapped || decl_wrapped {
                let pos = first_non_directive_pos(module);
                module.body.insert(pos, make_import_decl());
            }
        }
    }

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(FullPass { filename: "test.tsx".to_string() }),
        full_pipeline_injects_import_for_fn_decl,
        r#"
            "use client";
            export default function MyComponent() {}
        "#,
        r#"
            "use client";
            import { __turbosight_wrap } from "@think-grid-labs/turbosight";
            export default __turbosight_wrap(function MyComponent() {}, "test.tsx", "MyComponent");
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(FullPass { filename: "test.tsx".to_string() }),
        full_pipeline_injects_import_for_ident,
        r#"
            "use client";
            const App = () => "Hello";
            export default App;
        "#,
        r#"
            "use client";
            import { __turbosight_wrap } from "@think-grid-labs/turbosight";
            const App = () => "Hello";
            export default __turbosight_wrap(App, "test.tsx", "App");
        "#
    );

    test_inline!(
        Default::default(),
        |_| visit_mut_pass(FullPass { filename: "test.tsx".to_string() }),
        full_pipeline_skips_server_module,
        r#"
            export default function ServerPage() {}
        "#,
        r#"
            export default function ServerPage() {}
        "#
    );
}
