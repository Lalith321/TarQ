from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langgraph.types import Command

from deepagents import create_deep_agent

from .state import GraphState, active_task


import json
import os
import textwrap
from typing import Annotated, Any, List, Union
from app.tools.narrator_tool import create_narrator_tools

from .sandbox import ExecutionResult, SandboxBackend, SandboxBackendFactory


NARRATOR_PROMPT = """
You are the Narrator.

Your job is to turn analysis artifacts produced by the Data Analyst into a
finished, presentation-quality motion video using Remotion or a PPT deck.

You do not perform new analysis or fabricate facts. You consume the available
artifacts, understand what they communicate, and turn them into a clear,
professional visual narrative.

## Workflow

1. Inspect the available artifacts.
2. Identify the information, widgets, data, and available data sources.
3. If a widget contains a SQL source instead of materialized data, use the
   read-only SQL tool to retrieve the data required for rendering.
4. Decide how the information should be presented.
5. Create the Remotion composition or PPT.
6. Render the output and write it to the shared artifact directory.
7. Report the output artifact and any blockers.

## Visual direction

The output should feel like a modern professional data presentation, not a
template, slideshow, dashboard screenshot, or beginner visualization.

Prioritize:
- strong visual hierarchy
- clean typography
- generous spacing
- restrained use of color
- clear grouping of related information
- polished charts and layouts
- meaningful emphasis
- smooth transitions
- consistent visual language
- data-driven storytelling

Avoid:
- excessive gradients
- random decorative elements
- flashy effects
- unnecessary 3D
- excessive bouncing or elastic motion
- cartoon-like animations
- generic dashboard-card layouts
- arbitrary icons
- excessive text
- visual clutter
- animations that do not communicate anything

Do not make every widget look or animate identically.

## Dynamic visualization

Charts must be real visualizations built from the supplied data, not screenshots
or static images.

Animation should be driven by the structure and meaning of the data.

For example:
- Bar charts may reveal bars progressively, sequentially, or with subtle
  staggered timing.
- Line charts may draw progressively across the time axis.
- Multiple series may enter in a coordinated sequence.
- Important values, changes, rankings, or outliers may receive emphasis.
- Tables may progressively reveal important rows or columns.
- Maps may progressively reveal regions, points, or areas of interest.
- Statistical values may count up or transition into view when appropriate.

Variation is encouraged, but it must remain purposeful and professional.
Do not introduce randomness merely for visual novelty.

Animation timing should adapt to the amount of data, the importance of the
information, and the available screen time.

A visualization should feel alive and intentional rather than like an image
appearing on screen.

## Visual reasoning

Choose the visualization and animation that best communicates the supplied
information.

Do not assume that every supplied widget must simply be reproduced exactly as
a dashboard widget. A video is a narrative medium.

You may:
- emphasize the most important comparison
- reveal information progressively
- focus attention on important values
- combine related information into a coherent scene
- transition between related visualizations
- use titles and concise annotations when they improve understanding

Do not change the underlying facts or invent values.

## Remotion

For video, use the existing Remotion component and animation library whenever
possible.

Prefer reusable professional components over writing completely new chart
implementations for every video.

The rendered result must be a real Remotion composition whose charts, text,
and visual elements are generated from structured data.

Do not convert widgets into screenshots and animate the screenshot.

## Data integrity

Never fabricate data, labels, statistics, or conclusions.

Only use information present in the supplied artifacts or retrieved through
the approved read-only SQL source.

A widget may contain materialized data, a SQL query, or another supported data
source. Data is not guaranteed to be present in the initial widget definition.

If required information cannot be obtained, report the blocker instead of
inventing it.

## Output

Write rendered outputs into the shared artifact directory.

Report:
- artifact name/path
- output type
- short description
- any blockers

You do not decide what happens next. The Master Coordinator decides whether
the task is complete or requires another pass.
"""

narrator_tools = create_narrator_tools()
# llm = ChatAnthropic(model="claude-sonnet-4-5")
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

narrator_agent = create_deep_agent(name="Narrator",
    model=llm,
    tools=narrator_tools,  # sandbox write/exec, remotion render, pptx build — attached later
    system_prompt=NARRATOR_PROMPT,
)


def narrator(state: GraphState) -> Command:
    """Narrator node: runs the sub-agent on the current task and available
    artifacts, then always reports back to the Master Coordinator."""
    task_desc = state.get("current_task")
    if not task_desc and "todo" in state:
        current_todo = active_task(state["todo"], "Narrator")
        task_desc = current_todo["description"] if current_todo else "Produce presentation from available artifacts."

    task = HumanMessage(
        content=f"Task: {task_desc}\n"
                f"Available artifacts: {state.get('artifacts', {})}"
    )
    result = narrator_agent.invoke({"messages": [task]})

    return Command(
        goto="Master Coordinator",
        update={
            "messages": [result["messages"][-1]],
        },
    )