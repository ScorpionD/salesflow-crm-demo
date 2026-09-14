GRANT USAGE ON SCHEMA public TO salesflow_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON workspaces,sessions TO salesflow_app;
GRANT SELECT,INSERT,UPDATE ON users,workspace_members,pipeline_stages,companies,contacts,deals,tasks,automation_events TO salesflow_app;
GRANT SELECT,INSERT ON notes,activities TO salesflow_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO salesflow_app;
