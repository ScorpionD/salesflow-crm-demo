export async function onRequest({request,env}){return env.SALESFLOW_API.fetch(request);}
