"""Request boundaries: clients supply commands, never stored history or IDs."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["new", "in_progress", "resolved"]
Priority = Literal["low", "normal", "urgent"]
Category = Literal["access", "software", "billing", "other"]
Version = Annotated[int, Field(strict=True, ge=1)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


class CreateInput(Input):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    customer: str = Field(min_length=2, max_length=80)
    category: Category
    priority: Priority


class TransitionInput(Input):
    status: Status
    note: str | None = Field(default=None, min_length=1, max_length=2000)
    expectedVersion: Version


class CommentInput(Input):
    text: str = Field(min_length=1, max_length=2000)
    expectedVersion: Version


class PriorityInput(Input):
    priority: Priority
    expectedVersion: Version


class Activity(BaseModel):
    id: str
    kind: Literal["created", "status", "comment", "priority"]
    text: str
    at: str


class RequestView(BaseModel):
    id: str
    title: str
    description: str
    customer: str
    category: Category
    priority: Priority
    status: Status
    createdAt: str
    updatedAt: str
    resolution: str | None
    activity: list[Activity]
    version: Version
