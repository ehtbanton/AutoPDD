# AutoPDD Complete System Test Plan

## Overview
This test plan verifies the end-to-end functionality of the AutoPDD system, including the new JSON-based quote extraction, source navigation, and error handling features.

## Prerequisites
- AutoPDD system is running (frontend and backend)
- Test documents available:
  - Sample Word template (`.docx`) with placeholder fields
  - Sample PDF context documents with known content
  - Test template with various field types (tables, paragraphs, placeholders)

## Test Categories

### 1. Document Upload and Initialization Tests

#### Test 1.1: Template Upload
**Objective**: Verify template document upload and processing

**Steps**:
1. Navigate to AutoPDD interface
2. Upload a `.docx` template file using "Upload Template" button
3. Verify template appears in the PDD Viewer
4. Check that sections are detected and listed in Section Panel

**Expected Results**:
- Template file uploads successfully
- Document renders correctly in viewer
- Console logs show successful template processing
- Section list populates with detected headings
- Status shows sections as "UNATTEMPTED"

**Pass Criteria**: ✅ All expected results achieved

#### Test 1.2: Context Document Upload
**Objective**: Verify PDF context document upload and processing

**Steps**:
1. Upload multiple PDF files using "Upload" button in Context area
2. Select different context files from dropdown
3. Verify PDFs render correctly in Context Viewer

**Expected Results**:
- All PDF files upload successfully
- Context dropdown shows all uploaded files
- PDF content displays correctly in viewer
- Console logs show successful context processing

**Pass Criteria**: ✅ All expected results achieved

#### Test 1.3: Error Handling - Invalid Files
**Objective**: Test error handling for invalid file uploads

**Steps**:
1. Attempt to upload non-.docx file as template
2. Attempt to upload non-PDF file as context
3. Upload corrupted files

**Expected Results**:
- Clear error messages displayed
- System remains stable
- No partial uploads occur
- User can retry with valid files

**Pass Criteria**: ✅ Appropriate error handling demonstrated

### 2. AI Processing Tests

#### Test 2.1: Single Section Processing
**Objective**: Test AI processing of individual sections

**Steps**:
1. Click on a specific section in Section Panel
2. Click "Fill Section" button
3. Monitor processing logs
4. Verify section status updates
5. Check document for filled content

**Expected Results**:
- Processing starts and completes without errors
- Console shows detailed processing logs
- Section status changes from "UNATTEMPTED" → "ATTEMPTED"/"COMPLETE"
- Document shows new content with source citations
- No system crashes or hangs

**Pass Criteria**: ✅ Section processes successfully with appropriate status

#### Test 2.2: Full Document Processing
**Objective**: Test AI processing of entire document

**Steps**:
1. Click "Fill Document" button
2. Monitor console output during processing
3. Wait for completion
4. Review all sections in document
5. Check section statuses

**Expected Results**:
- All sections process sequentially
- Console shows progress for each section
- Final document contains filled information
- Section statuses reflect processing results
- Source citations appear throughout document

**Pass Criteria**: ✅ Document processes completely with minimal errors

#### Test 2.3: Error Handling - AI Processing Issues
**Objective**: Test handling of AI processing failures

**Steps**:
1. Process sections with insufficient context
2. Test with malformed templates
3. Simulate network issues during processing

**Expected Results**:
- Graceful handling of AI failures
- "INFO_NOT_FOUND" used for missing information
- Section marked as "ATTEMPTED" when issues occur
- Clear error messages in console
- System remains responsive

**Pass Criteria**: ✅ Errors handled gracefully without system failure

### 3. Source Navigation Tests

#### Test 3.1: Basic Right-Click Navigation
**Objective**: Test right-click navigation to source documents

**Steps**:
1. Process a section with the AI
2. Locate filled content with source citations
3. Right-click on filled text
4. Observe Context Viewer behavior

**Expected Results**:
- Right-click prevents default context menu
- Context Viewer switches to correct document
- PDF scrolls to correct page number
- Success message appears in console
- Navigation completes smoothly

**Pass Criteria**: ✅ Source navigation works accurately

#### Test 3.2: Metadata Detection
**Objective**: Test detection of various metadata formats

**Steps**:
1. Right-click on text with visible citations: "(Source: doc.pdf, Page 5)"
2. Right-click on text with hidden metadata
3. Right-click on text without source information
4. Test with various citation formats

**Expected Results**:
- Visible citations detected correctly
- Hidden JSON metadata parsed successfully
- Text without sources shows appropriate message
- Various formats handled robustly
- No JavaScript errors occur

**Pass Criteria**: ✅ All metadata formats detected appropriately

#### Test 3.3: Error Handling - Navigation Issues
**Objective**: Test navigation error scenarios

**Steps**:
1. Right-click on text referencing non-uploaded document
2. Test with malformed metadata
3. Test with invalid page numbers
4. Test with missing context files

**Expected Results**:
- Clear error messages for missing documents
- Graceful handling of malformed metadata
- Invalid page numbers handled appropriately
- System remains stable during errors
- User can continue working normally

**Pass Criteria**: ✅ Navigation errors handled gracefully

### 4. Integration Tests

#### Test 4.1: Complete Workflow Test
**Objective**: Test entire workflow from start to finish

**Steps**:
1. Start with clean system
2. Upload template and context documents
3. Process entire document with AI
4. Test source navigation on multiple filled items
5. Verify document download functionality

**Expected Results**:
- Complete workflow executes without interruption
- All features work together seamlessly
- Document contains properly filled content
- Source navigation works throughout document
- Downloaded document retains all formatting and content

**Pass Criteria**: ✅ End-to-end workflow successful

#### Test 4.2: Data Consistency Test
**Objective**: Verify data consistency between backend and frontend

**Steps**:
1. Process sections and note console output
2. Verify section statuses match backend processing results
3. Check that document content matches AI responses
4. Validate source information accuracy

**Expected Results**:
- Frontend status matches backend processing
- Document content reflects AI responses accurately
- Source citations match original documents
- No data corruption during transfer
- Consistent behavior across browser sessions

**Pass Criteria**: ✅ Data remains consistent throughout system

### 5. Performance and Reliability Tests

#### Test 5.1: Large Document Test
**Objective**: Test system with large documents

**Steps**:
1. Upload large template (50+ pages)
2. Upload multiple large PDF context files
3. Process entire document
4. Test navigation performance

**Expected Results**:
- System handles large files without crashes
- Processing completes within reasonable time
- Memory usage remains acceptable
- UI remains responsive during processing
- Navigation works smoothly with large documents

**Pass Criteria**: ✅ System performs well with large documents

#### Test 5.2: Stress Test
**Objective**: Test system reliability under load

**Steps**:
1. Process multiple sections rapidly
2. Test rapid context switching
3. Perform many source navigation operations
4. Test system recovery after errors

**Expected Results**:
- System remains stable under rapid operations
- No memory leaks or performance degradation
- Error recovery works consistently
- UI responds appropriately to user actions
- Background processing handles queue correctly

**Pass Criteria**: ✅ System maintains stability under stress

## Test Results Summary

### Critical Issues (Must Fix Before Release)
- [ ] **Issue 1**: _[To be filled during testing]_
- [ ] **Issue 2**: _[To be filled during testing]_

### Minor Issues (Should Fix)
- [ ] **Issue 1**: _[To be filled during testing]_
- [ ] **Issue 2**: _[To be filled during testing]_

### Enhancement Opportunities
- [ ] **Enhancement 1**: _[To be filled during testing]_
- [ ] **Enhancement 2**: _[To be filled during testing]_

## Test Environment
- **Browser**: Chrome/Edge/Firefox
- **Operating System**: Windows 10/11
- **Node.js Version**: [Version]
- **Python Version**: [Version]
- **Date of Testing**: [Date]
- **Tester**: [Name]

## Success Criteria
✅ **System Ready for Production**: All critical tests pass, no data loss, stable performance

## Notes
- Document any unexpected behavior during testing
- Keep detailed logs of error scenarios
- Test with various document types and sizes
- Verify cross-browser compatibility

---

## Quick Test Checklist
Use this for rapid verification:

- [ ] Template uploads and displays correctly
- [ ] Context PDFs upload and display correctly
- [ ] AI processing completes without errors
- [ ] Source citations appear in filled content
- [ ] Right-click navigation works to correct pages
- [ ] Error messages are clear and helpful
- [ ] Document download works properly
- [ ] System handles edge cases gracefully

## Automated Test Scripts

### Backend API Tests
```python
# Test script for backend API endpoints
def test_section_processing():
    # Test fill_document_with_json function
    # Verify JSON structure handling
    # Check error responses
    pass

def test_metadata_embedding():
    # Test word_editor.py functions
    # Verify metadata format
    # Check source information accuracy
    pass
```

### Frontend Component Tests
```javascript
// Test script for frontend components
describe('Source Navigation', () => {
  test('extracts metadata correctly', () => {
    // Test extractSourceMetadata function
    // Verify various metadata formats
    // Check error handling
  });

  test('navigates to correct page', () => {
    // Test PDF navigation
    // Verify page jumping
    // Check navigation completion
  });
});
```

This comprehensive test plan ensures all aspects of the system work together correctly and handles edge cases gracefully.