"""Local desktop demo server and safe proxy to the ADK evaluation workflow."""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from app.agent import app as agent_app
from app.environment import PROJECT_ROOT
from app.evaluation_api import router as evaluation_router
from app.runtime_client import AgentRuntimeEvaluationClient

WEB_DIR = PROJECT_ROOT / "web"

server = FastAPI(title="제주너머 데스크톱 데모")
server.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="assets")
server.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

session_service = InMemorySessionService()
runner = Runner(
    app=agent_app, session_service=session_service, auto_create_session=True
)
server.state.runner = runner
server.state.session_service = session_service
server.state.runtime_evaluation_client = (
    AgentRuntimeEvaluationClient.from_environment()
)
server.include_router(evaluation_router, prefix="/api")


@server.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app = server
