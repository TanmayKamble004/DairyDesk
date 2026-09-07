"""Set (or remove) the security question that recovers a forgotten password.

    manage.py set_security_question anil              # prompts for the answer
    manage.py set_security_question anil --question "..."
    manage.py set_security_question anil --clear      # switch recovery off

Deliberately a command rather than a field on the Staff form. The answer is a
credential — whoever supplies it can set a new password — so it is asked for at
a prompt that does not echo, hashed before it is stored, and never written to
this repository. `--answer` exists for scripted setup and is documented as the
worse option because it lands in shell history.

Only accounts that have been through this command can recover a password;
everybody else goes to an owner, which is the flow that already exists on the
Staff page.
"""
import getpass

from django.core.management.base import BaseCommand, CommandError

from core.models import User

# The question as specified for this deployment. Overridable per account with
# --question, since nothing here assumes every account shares one.
DEFAULT_QUESTION = "Whose name and birth year are combined to create the password"


class Command(BaseCommand):
    help = "Set the security question used to recover a forgotten password."

    def add_arguments(self, parser):
        parser.add_argument("username", help="The account to configure.")
        parser.add_argument(
            "--question",
            default=DEFAULT_QUESTION,
            help="Question text shown on the forgotten-password page.",
        )
        parser.add_argument(
            "--answer",
            help=(
                "Answer, non-interactively. Prefer the prompt: an answer passed "
                "as an argument is recorded in your shell history."
            ),
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove the question and answer, disabling recovery for this account.",
        )

    def handle(self, *args, **options):
        username = options["username"]
        user = User.objects.filter(username=username).first()
        if user is None:
            raise CommandError(f"No user named '{username}'.")

        fields = ["security_question", "security_answer"]

        if options["clear"]:
            user.security_question = ""
            user.security_answer = ""
            user.save(update_fields=fields)
            self.stdout.write(
                self.style.SUCCESS(f"Recovery removed from '{username}'.")
            )
            return

        answer = options["answer"]
        if not answer:
            self.stdout.write(f"Question: {options['question']}")
            answer = getpass.getpass("Answer (not echoed): ")
            # Typed blind and needed months from now — one slip at setup is a
            # lockout nobody discovers until the day it matters.
            if answer != getpass.getpass("Answer again: "):
                raise CommandError("The answers do not match; nothing was changed.")

        if not answer.strip():
            raise CommandError("The answer cannot be blank.")

        if not user.is_active:
            # Not fatal — an owner may be setting this up before switching the
            # account on — but the reset endpoints refuse disabled accounts, so
            # it would otherwise look broken.
            self.stdout.write(
                self.style.WARNING(
                    f"'{username}' is currently disabled. Recovery stays refused "
                    "until the account is active again."
                )
            )

        user.security_question = options["question"]
        user.set_security_answer(answer)
        user.save(update_fields=fields)

        self.stdout.write(
            self.style.SUCCESS(
                f"Security question set for '{username}' ({user.role}). "
                "The answer is stored hashed; case and spacing are ignored when "
                "it is checked."
            )
        )
