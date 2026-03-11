
param(
    [string]$BaseUrl = "http://localhost:5001",
    [string]$MongoContainer = "exam-shield-mongo",
    [string]$Database = "online_exam",
    [string]$AdminEmail = "admin@gmail.com",
    [string]$AdminPassword = "admin"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$envFilePath = Join-Path $workspaceRoot ".env.docker"
$runId = Get-Date -Format "yyyyMMddHHmmss"
$prefix = "Regression $runId"
Set-Location $workspaceRoot
$created = [ordered]@{
    TrainerId = $null
    SubjectId = $null
    QuestionIds = New-Object System.Collections.Generic.List[string]
    TestIds = New-Object System.Collections.Generic.List[string]
    TraineeIds = New-Object System.Collections.Generic.List[string]
}

function Step([string]$m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Need([bool]$ok, [string]$m) { if (-not $ok) { throw $m } }
function EnvValue([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return $null }
    $line = Select-String -Path $path -Pattern ("^{0}=(.*)$" -f [Regex]::Escape($key)) | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Matches[0].Groups[1].Value.Trim()
}
function ErrorText($err) {
    $response = $err.Exception.Response
    if ($response -and $response.GetResponseStream) {
        try {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $body = $reader.ReadToEnd()
            if ($body) {
                try {
                    $json = $body | ConvertFrom-Json
                    if ($json.message) { return "$($response.StatusCode.value__) $($json.message)" }
                } catch {
                    return "$($response.StatusCode.value__) $body"
                }
            }
        } catch {}
    }
    return $err.Exception.Message
}
function Api([string]$method, [string]$path, $body = $null, [string]$token = "") {
    $headers = @{}
    if ($token) { $headers.Authorization = "Bearer $token" }
    $params = @{ Method = $method; Uri = "$BaseUrl$path"; Headers = $headers; TimeoutSec = 120; ErrorAction = 'Stop' }
    if ($method -ne 'GET' -and $null -ne $body) {
        $params.ContentType = 'application/json'
        $params.Body = ($body | ConvertTo-Json -Depth 20)
    }
    try { Invoke-RestMethod @params } catch { throw "Request failed for $method $path :: $(ErrorText $_)" }
}
function Ok([string]$method, [string]$path, $body = $null, [string]$token = '', [string]$message = '') {
    $response = Api $method $path $body $token
    if ($response.PSObject.Properties.Name -contains 'success') {
        Need ($response.success -eq $true) ($(if ($message) { $message } else { "Expected success response from $path" }))
    } elseif ($null -eq $response) {
        throw ($(if ($message) { $message } else { "Empty response from $path" }))
    }
    return $response
}
function Login([string]$email, [string]$password) {
    $response = Ok 'POST' '/api/v1/login/' @{ emailid = $email; password = $password } '' "Unable to login for $email"
    Need (-not [string]::IsNullOrWhiteSpace([string]$response.token)) "Login response missing token for $email"
    return $response
}
function Mongo([string]$js) {
    $escaped = $js.Replace('"', '\"')
    (& docker exec $MongoContainer mongosh --quiet --eval $escaped | Out-String).Trim()
}
function Cleanup() {
    if ($created.TestIds.Count -eq 0 -and -not $created.TrainerId -and -not $created.SubjectId) { return }
    Step 'Cleaning regression data'
    $testIdsJs = ($created.TestIds | ForEach-Object { "ObjectId('$_')" }) -join ','
    $traineeIdsJs = ($created.TraineeIds | ForEach-Object { "ObjectId('$_')" }) -join ','
    $questionIdsJs = ($created.QuestionIds | ForEach-Object { "ObjectId('$_')" }) -join ','
    $subjectIdJs = if ($created.SubjectId) { "ObjectId('$($created.SubjectId)')" } else { 'null' }
    $trainerIdJs = if ($created.TrainerId) { "ObjectId('$($created.TrainerId)')" } else { 'null' }
    $cleanupJs = @"
const dbx = db.getSiblingDB('$Database');
const testIds = [$testIdsJs];
const traineeIds = [$traineeIdsJs];
const questionIds = [$questionIdsJs];
const subjectId = $subjectIdJs;
const trainerId = $trainerIdJs;
const answerIds = [];
const subResultIds = [];
const optionIds = [];
if (testIds.length) {
  dbx.resultmodels.find({ testid: { `$in: testIds } }, { result: 1 }).forEach((doc) => (doc.result || []).forEach((id) => subResultIds.push(id)));
  dbx.answersheetmodels.find({ testid: { `$in: testIds } }, { answers: 1 }).forEach((doc) => (doc.answers || []).forEach((id) => answerIds.push(id)));
  dbx.proctorrisksnapshotmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.proctoreventmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.preflightrunmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.psychometricmetricmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.moderationactionmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.accommodationprofilemodels.deleteMany({ testid: { `$in: testIds } });
  dbx.feedbackmodels.deleteMany({ testid: { `$in: testIds } });
  dbx.resultmodels.deleteMany({ testid: { `$in: testIds } });
  if (subResultIds.length) dbx.subresultsmodels.deleteMany({ _id: { `$in: subResultIds } });
  dbx.answersheetmodels.deleteMany({ testid: { `$in: testIds } });
  if (answerIds.length) dbx.answersmodels.deleteMany({ _id: { `$in: answerIds } });
  dbx.traineeentermodels.deleteMany({ _id: { `$in: traineeIds } });
  dbx.testpapermodels.deleteMany({ _id: { `$in: testIds } });
}
if (questionIds.length) {
  dbx.questionmodels.find({ _id: { `$in: questionIds } }, { options: 1 }).forEach((doc) => (doc.options || []).forEach((id) => optionIds.push(id)));
  dbx.questionmodels.deleteMany({ _id: { `$in: questionIds } });
}
if (optionIds.length) dbx.options.deleteMany({ _id: { `$in: optionIds } });
if (subjectId) dbx.subjectmodels.deleteOne({ _id: subjectId });
if (trainerId) dbx.usermodels.deleteOne({ _id: trainerId });
"@
    Mongo $cleanupJs | Out-Null
}

$mailRecipient = EnvValue $envFilePath 'MAIL_USER'
if ([string]::IsNullOrWhiteSpace($mailRecipient)) { $mailRecipient = "regression-$runId@example.com" }
$modePolicies = @{ LIGHT = @('camera'); STANDARD = @('camera', 'microphone'); STRICT = @('camera', 'microphone', 'fullscreen', 'screen_share') }
$summary = New-Object System.Collections.Generic.List[object]
try {
    Step 'Checking Docker services'
    $dockerPs = & docker compose --env-file $envFilePath ps --format json
    $dockerPsText = ($dockerPs | Out-String)
    Need ($LASTEXITCODE -eq 0) 'Docker compose services are not available.'
    Need ($dockerPsText -match '"Service":"backend"') 'Backend service is not running.'
    Need ($dockerPsText -match '"Service":"frontend"') 'Frontend service is not running.'
    Need ($dockerPsText -match '"Service":"mongo"') 'Mongo service is not running.'

    Step 'Logging in as admin'
    $adminLogin = Login $AdminEmail $AdminPassword
    $adminToken = [string]$adminLogin.token
    $adminDashboard = Ok 'GET' '/api/v1/dashboard/' $null $adminToken 'Admin dashboard fetch failed'
    Need ($adminDashboard.userType -eq 'ADMIN') 'Admin dashboard returned unexpected user type.'

    $subjectName = "$prefix Subject"
    Step 'Creating regression subject'
    Ok 'POST' '/api/v1/subject/create' @{ topic = $subjectName } $adminToken 'Admin subject creation failed' | Out-Null
    $subjectsResponse = Ok 'GET' '/api/v1/subject/details/all' $null $adminToken 'Unable to list subjects'
    $createdSubject = @($subjectsResponse.data) | Where-Object { $_.topic -eq $subjectName } | Select-Object -First 1
    Need ($null -ne $createdSubject) 'Created subject was not found.'
    $created.SubjectId = [string]$createdSubject._id

    $trainerEmail = "regression.examiner.$runId@example.com"
    $trainerPassword = 'Passw0rd!'
    Step 'Creating regression examiner'
    Ok 'POST' '/api/v1/admin/trainer/create' @{
        name = "$prefix Examiner"
        emailid = $trainerEmail
        password = $trainerPassword
        contact = "2519$($runId.Substring($runId.Length - 8))"
    } $adminToken 'Admin examiner creation failed' | Out-Null
    $allTrainers = Ok 'GET' '/api/v1/admin/trainer/details/all' $null $adminToken 'Unable to list examiners'
    $createdTrainer = @($allTrainers.data) | Where-Object { $_.emailid -eq $trainerEmail } | Select-Object -First 1
    Need ($null -ne $createdTrainer) 'Created examiner was not found.'
    $created.TrainerId = [string]$createdTrainer._id

    Step 'Logging in as examiner'
    $trainerLogin = Login $trainerEmail $trainerPassword
    $trainerToken = [string]$trainerLogin.token
    $trainerDashboard = Ok 'GET' '/api/v1/dashboard/' $null $trainerToken 'Examiner dashboard fetch failed'
    Need ($trainerDashboard.userType -eq 'TRAINER') 'Examiner dashboard returned unexpected user type.'

    Step 'Creating regression questions'
    for ($i = 1; $i -le 3; $i++) {
        Ok 'POST' '/api/v1/questions/create' @{
            body = "$prefix Question $i"
            subject = $created.SubjectId
            difficulty = 2
            weightage = 1
            options = @(
                @{ optbody = "Correct option $i"; isAnswer = $true },
                @{ optbody = "Distractor A $i"; isAnswer = $false },
                @{ optbody = "Distractor B $i"; isAnswer = $false },
                @{ optbody = "Distractor C $i"; isAnswer = $false }
            )
        } $trainerToken "Question creation failed for question $i" | Out-Null
    }
    $questionsResponse = Ok 'POST' '/api/v1/questions/details/all' @{ subject = $created.SubjectId } $trainerToken 'Unable to list created questions'
    $createdQuestions = @($questionsResponse.data) | Where-Object { $_.body -like "$prefix Question *" } | Sort-Object body
    Need ($createdQuestions.Count -ge 3) 'Expected three created questions.'
    $createdQuestions | ForEach-Object { [void]$created.QuestionIds.Add([string]$($_._id)) }

    foreach ($mode in @('LIGHT', 'STANDARD', 'STRICT')) {
        Step "Creating $mode exam"
        $createExamResponse = Ok 'POST' '/api/v1/test/create' @{
            title = "$prefix $mode Exam"
            questions = @($created.QuestionIds)
            organisation = 'Regression QA'
            duration = 60
            subjects = @($created.SubjectId)
            integrityMode = $mode
            preflightEnabled = $true
        } $trainerToken "Exam creation failed for $mode"
        $testId = [string]$createExamResponse.testid
        Need (-not [string]::IsNullOrWhiteSpace($testId)) "Exam creation for $mode did not return a test id."
        [void]$created.TestIds.Add($testId)

        Ok 'POST' '/api/v1/test/face-recognition' @{ id = $testId; enabled = $false } $trainerToken "Unable to disable face recognition for $mode exam" | Out-Null
        $basicDetails = Ok 'POST' '/api/v1/test/basic/details' @{ id = $testId } $trainerToken "Unable to fetch basic test details for $mode"
        Need ($basicDetails.data.integrityMode -eq $mode) "Unexpected integrity mode in basic details for $mode."
        $integrityDetails = Ok 'POST' '/api/v1/test/integrity/details' @{ id = $testId } $trainerToken "Unable to fetch integrity config for $mode"
        Need ($integrityDetails.data.integrityMode -eq $mode) "Unexpected integrity mode in integrity config for $mode."
        $registrationConfig = Ok 'POST' '/api/v1/trainee/register/config' @{ testid = $testId } $null "Unable to fetch registration config for $mode"
        Need ($registrationConfig.data.integrityMode -eq $mode) "Registration config mode mismatch for $mode."
        Need ($registrationConfig.data.faceRecognitionEnabled -eq $false) "Face recognition should be disabled for $mode."

        $registrationResponse = Ok 'POST' '/api/v1/trainee/enter' @{
            name = "$prefix $mode Examinee"
            emailid = $mailRecipient
            contact = "2517$($runId.Substring($runId.Length - 7))$(([int]($mode.Length + 3)))"
            organisation = 'Regression QA'
            testid = $testId
            location = 'Nairobi'
        } $null "Examinee registration failed for $mode"
        Need ($registrationResponse.emailDelivered -ne $false) "Registration email delivery failed for $mode."
        $traineeId = [string]$registrationResponse.user._id
        [void]$created.TraineeIds.Add($traineeId)
        Ok 'POST' '/api/v1/trainee/resend/testlink' @{ id = $traineeId } $null "Resend email failed for $mode" | Out-Null

        $preflightStart = Ok 'POST' '/api/v1/trainee/preflight/start' @{
            testid = $testId
            traineeid = $traineeId
            clientMeta = @{ userAgent = 'Regression Bot'; platform = 'Windows'; screenWidth = 1440; screenHeight = 900; timezone = 'Africa/Nairobi' }
        } $null "Preflight start failed for $mode"
        $runIdValue = [string]$preflightStart.data.runid
        foreach ($check in $modePolicies[$mode]) {
            Ok 'POST' '/api/v1/trainee/preflight/check' @{
                runid = $runIdValue; testid = $testId; traineeid = $traineeId; checkType = $check; passed = $true; value = 'ok'; reason = ''
            } $null "Preflight check '$check' failed for $mode" | Out-Null
        }
        $preflightComplete = Ok 'POST' '/api/v1/trainee/preflight/complete' @{ runid = $runIdValue; testid = $testId; traineeid = $traineeId } $null "Preflight completion failed for $mode"
        Need ($preflightComplete.data.status -eq 'PASSED') "Preflight did not pass for $mode."
        $latestPreflight = Ok 'POST' '/api/v1/trainee/preflight/latest' @{ testid = $testId; traineeid = $traineeId } $null "Unable to fetch latest preflight for $mode"
        Need ($latestPreflight.data.run.status -eq 'PASSED') "Latest preflight status mismatch for $mode."
        $summary.Add([pscustomobject]@{ Mode = $mode; TestId = $testId; TraineeId = $traineeId; Registration = 'PASS'; Resend = 'PASS'; Preflight = 'PASS' }) | Out-Null
    }
    $strictRun = $summary | Where-Object { $_.Mode -eq 'STRICT' } | Select-Object -First 1
    Need ($null -ne $strictRun) 'Strict regression run was not created.'
    Step 'Running live exam flow against STRICT exam'
    $strictTestId = [string]$strictRun.TestId
    $strictTraineeId = [string]$strictRun.TraineeId

    $startExamResponse = Ok 'POST' '/api/v1/test/begin' @{ id = $strictTestId } $trainerToken 'Examiner failed to start strict exam'
    Need ($startExamResponse.data.testbegins -eq $true) 'Strict exam did not enter live state.'
    $flagsBeforeEntry = Ok 'POST' '/api/v1/trainee/flags' @{ testid = $strictTestId; traineeid = $strictTraineeId } $null 'Unable to fetch flags before entry'
    Need ($flagsBeforeEntry.data.testbegins -eq $true) 'Examinee flags do not show live exam state.'
    Ok 'POST' '/api/v1/trainee/answersheet' @{ userid = $strictTraineeId; testid = $strictTestId } $null 'Examinee failed to create answer sheet' | Out-Null

    $questionPaper = Ok 'POST' '/api/v1/trainee/paper/questions' @{ id = $strictTestId } $null 'Unable to fetch strict exam question paper'
    Need (@($questionPaper.data).Count -ge 1) 'Strict exam returned no questions.'
    $firstQuestion = @($questionPaper.data)[0]
    $firstOption = @($firstQuestion.options)[0]
    Need ($null -ne $firstOption) 'Strict exam first question does not contain options.'

    $chosenOptions = Ok 'POST' '/api/v1/trainee/chosen/options' @{ testid = $strictTestId; userid = $strictTraineeId } $null 'Unable to fetch chosen options'
    $sessionVersion = [int]$chosenOptions.data.sessionVersion
    Ok 'POST' '/api/v1/trainee/answers/batch-save' @{
        testid = $strictTestId
        userid = $strictTraineeId
        saveVersion = $sessionVersion
        lastSavedQuestionIndex = 0
        answers = @(@{ qid = [string]$firstQuestion._id; newAnswer = @([string]$firstOption._id) })
    } $null 'Batch answer save failed' | Out-Null
    Ok 'POST' '/api/v1/trainee/session/heartbeat' @{ testid = $strictTestId; userid = $strictTraineeId; activeQuestionIndex = 0 } $null 'Session heartbeat failed' | Out-Null
    Ok 'POST' '/api/v1/trainee/session/resume' @{ testid = $strictTestId; userid = $strictTraineeId } $null 'Session resume failed' | Out-Null

    $liveCandidates = Ok 'POST' '/api/v1/test/candidates' @{ id = $strictTestId } $trainerToken 'Unable to fetch live candidates'
    $liveCandidate = @($liveCandidates.data) | Where-Object { [string]$($_._id) -eq $strictTraineeId } | Select-Object -First 1
    if (-not $liveCandidate) { $liveCandidate = @($liveCandidates.data)[0] }
    Need ($null -ne $liveCandidate) 'Strict examinee did not appear in live candidate list.'
    Need ($liveCandidate.examProgress.status -eq 'in_progress') 'Strict examinee is not marked in progress.'

    $proctorSummary = Ok 'POST' '/api/v1/test/proctor/summary' @{ testid = $strictTestId; traineeids = @($strictTraineeId) } $trainerToken 'Unable to fetch proctor summary'
    Need (@($proctorSummary.data).Count -ge 1) 'Proctor summary did not return an entry.'
    $proctorEvents = Ok 'POST' '/api/v1/test/proctor/events' @{ testid = $strictTestId; traineeid = $strictTraineeId; limit = 20 } $trainerToken 'Unable to fetch proctor events'
    $eventTypes = @($proctorEvents.data.items) | ForEach-Object { [string]$_.eventType }
    Need ($eventTypes -contains 'EXAM_STARTED') 'Proctor timeline did not record exam start.'

    Ok 'POST' '/api/v1/trainee/end/test' @{ testid = $strictTestId; userid = $strictTraineeId } $null 'Examinee failed to end exam' | Out-Null
    $flagsAfterSubmit = Ok 'POST' '/api/v1/trainee/flags' @{ testid = $strictTestId; traineeid = $strictTraineeId } $null 'Unable to fetch flags after submission'
    Need ($flagsAfterSubmit.data.completed -eq $true) 'Examinee completion state did not update after submission.'
    $endExamResponse = Ok 'POST' '/api/v1/test/end' @{ id = $strictTestId } $trainerToken 'Examiner failed to end strict exam'
    Need ($endExamResponse.data.testconducted -eq $true) 'Strict exam did not enter completed state.'

    $resultResponse = Ok 'POST' '/api/v1/final/results' @{ userid = $strictTraineeId; testid = $strictTestId } $null 'Result generation failed'
    Need ($null -ne $resultResponse.result) 'Result payload is missing.'
    $candidateDetails = Ok 'POST' '/api/v1/test/candidates/details' @{ testid = $strictTestId } $trainerToken 'Exam details candidate fetch failed'
    Need (@($candidateDetails.data).Count -ge 1) 'Candidate details did not return results.'
    $psychometricOverview = Ok 'POST' '/api/v1/test/psychometrics/overview' @{ testid = $strictTestId } $trainerToken 'Psychometric overview failed'
    Need ($psychometricOverview.data.sampleSize -ge 1) 'Psychometric overview sample size did not include the strict submission.'
    $psychometricQuestions = Ok 'POST' '/api/v1/test/psychometrics/questions' @{ testid = $strictTestId } $trainerToken 'Psychometric question metrics failed'
    Need (@($psychometricQuestions.data.questionMetrics).Count -ge 1) 'Psychometric question metrics did not return rows.'
    $trainerDashboardAfterRun = Ok 'GET' '/api/v1/dashboard/' $null $trainerToken 'Examiner dashboard fetch after regression failed'
    Need ($null -ne $trainerDashboardAfterRun.analytics.psychometrics) 'Examiner dashboard is missing psychometric analytics.'

    Write-Host ''
    Write-Host 'Regression pass completed successfully.' -ForegroundColor Green
    $summary | Format-Table -AutoSize | Out-String | Write-Host
} finally {
    Cleanup
}



